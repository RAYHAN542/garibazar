import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit, getClientIp } from "./_lib/rateLimit.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";

// ============================================================================
// api/account-actions.ts
// ============================================================================
// 🔧 (2026-09-26) Vercel's Hobby plan caps a deployment at 12 Serverless
// Functions. delete-account.ts, report-listing.ts, submit-support-ticket.ts
// were merged here for that reason. Dispatched by an `action` field in the
// request body, same pattern as api/auth/phone.ts and api/track-event.ts.
//
// 🔧 (2026-10-XX, Firebase removal) Firebase ID-token fallback removed.
// NOTE: any still-active Google/Facebook (Firebase-only) session can no
// longer use delete_account/report_listing/toggle_sold/submit_support_ticket
// until AuthModal.tsx's social login is also migrated to Supabase Auth
// (final step of this migration).
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveUid(req: any): Promise<string | null> {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.replace("Bearer ", "").trim();
  if (!idToken) return null;
  return await verifySupabaseToken(idToken);
}

// ---------------------------------------------------------------------------
// delete_account
// ---------------------------------------------------------------------------
async function handleDeleteAccount(req: any, res: any) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }
  const authUid = await resolveUid(req);
  if (!authUid) {
    return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
  }

  // 🔧 a migrated ("restore old account") user's real app-wide uid
  // (listings.seller_id, users.uid, public_profiles.uid, etc.) is their OLD
  // legacy id, not the fresh Supabase Auth id minted for their new login --
  // RLS's own current_uid() function resolves this via user_auth_links, so
  // this endpoint has to do the same lookup before deleting anything.
  let appUid = authUid;
  try {
    const { data } = await supabaseAdmin
      .from("user_auth_links")
      .select("app_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();
    if (data?.app_uid) appUid = data.app_uid;
  } catch (e) {
    console.error("[account-actions/delete_account] app uid resolution failed, using auth uid:", e);
  }

  const { error: delDataErr } = await supabaseAdmin.rpc("delete_user_data", { p_uid: appUid });
  if (delDataErr) {
    console.error("delete_user_data failed:", delDataErr.message);
    return res.status(500).json({ error: "অ্যাকাউন্ট মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
  // Best-effort: remove this user's uploaded images from Cloudinary.
  // appUid is validated so an empty/odd value can never match another prefix.
  try {
    const cName = process.env.CLOUDINARY_CLOUD_NAME;
    const cKey = process.env.CLOUDINARY_API_KEY;
    const cSecret = process.env.CLOUDINARY_API_SECRET;
    if (cName && cKey && cSecret && /^[A-Za-z0-9_-]{6,128}$/.test(appUid)) {
      const basic = Buffer.from(`${cKey}:${cSecret}`).toString("base64");
      const prefix = encodeURIComponent(`listings/${appUid}/`);
      const cr = await fetch(
        `https://api.cloudinary.com/v1_1/${cName}/resources/image/upload?prefix=${prefix}&invalidate=true`,
        { method: "DELETE", headers: { Authorization: `Basic ${basic}` } },
      );
      if (!cr.ok) console.error("[account-actions/delete_account] cloudinary cleanup failed:", cr.status);
    }
  } catch (e) {
    console.error("[account-actions/delete_account] cloudinary cleanup error:", e);
  }
  await supabaseAdmin.from("user_auth_links").delete().eq("auth_uid", authUid);

  const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUid);
  if (authDelErr) {
    console.error("[account-actions/delete_account] supabase auth delete failed:", authDelErr.message);
  }

  return res.status(200).json({ success: true });
}

// ---------------------------------------------------------------------------
// report_listing
// ---------------------------------------------------------------------------
const REPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const REPORT_RATE_LIMIT_MAX = 20; // per user per hour

async function handleReportListing(req: any, res: any) {
  const uid = await resolveUid(req);
  if (!uid) {
    return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
  }

  const { listingId } = req.body || {};
  if (!listingId || typeof listingId !== "string") {
    return res.status(400).json({ error: "listingId প্রয়োজন।" });
  }

  const allowed = await checkAndBumpRateLimit(`report_listing_${uid}`, REPORT_RATE_LIMIT_WINDOW_MS, REPORT_RATE_LIMIT_MAX);
  if (!allowed) {
    return res.status(429).json({ error: "অনেকবার রিপোর্ট করার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }

  const { data: listing, error: fetchErr } = await supabaseAdmin
    .from("listings")
    .select("report_count, reported_by")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[account-actions/report_listing] fetch error:", fetchErr.message);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
  if (!listing) {
    return res.status(404).json({ error: "লিস্টিং খুঁজে পাওয়া যায়নি।" });
  }

  const currentReportedBy: string[] = Array.isArray(listing.reported_by) ? listing.reported_by : [];
  if (currentReportedBy.includes(uid)) {
    return res.status(200).json({ reported: true, alreadyReported: true });
  }

  const nextReportedBy = [...currentReportedBy, uid];
  const nextReportCount = (Number(listing.report_count) || 0) + 1;

  const { error: updateErr } = await supabaseAdmin
    .from("listings")
    .update({ report_count: nextReportCount, reported_by: nextReportedBy })
    .eq("id", listingId);

  if (updateErr) {
    console.error("[account-actions/report_listing] update error:", updateErr.message);
    return res.status(500).json({ error: "রিপোর্ট সাবমিট করা যায়নি।" });
  }

  return res.status(200).json({ reported: true });
}

// ---------------------------------------------------------------------------
// toggle_sold
// ---------------------------------------------------------------------------
async function handleToggleSold(req: any, res: any) {
  const uid = await resolveUid(req);
  if (!uid) {
    return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
  }

  const { listingId, isSold } = req.body || {};
  if (!listingId || typeof listingId !== "string" || typeof isSold !== "boolean") {
    return res.status(400).json({ error: "অবৈধ অনুরোধ।" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }

  const { data: listing, error: fetchErr } = await supabaseAdmin
    .from("listings")
    .select("seller_id")
    .eq("id", listingId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[account-actions/toggle_sold] fetch error:", fetchErr.message);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
  if (!listing) {
    return res.status(404).json({ error: "লিস্টিং খুঁজে পাওয়া যায়নি।" });
  }
  if (listing.seller_id !== uid) {
    return res.status(403).json({ error: "শুধু বিক্রেতা নিজেই এটি পরিবর্তন করতে পারবেন।" });
  }

  const { error: updateErr } = await supabaseAdmin.from("listings").update({ is_sold: isSold }).eq("id", listingId);
  if (updateErr) {
    console.error("[account-actions/toggle_sold] update error:", updateErr.message);
    return res.status(500).json({ error: "স্ট্যাটাস পরিবর্তন করা যায়নি।" });
  }

  return res.status(200).json({ success: true, isSold });
}

// ---------------------------------------------------------------------------
// submit_support_ticket
// ---------------------------------------------------------------------------
const GUEST_WINDOW_MS = 60 * 60 * 1000;
const GUEST_MAX = 3; // per IP
const USER_WINDOW_MS = 60 * 60 * 1000;
const USER_MAX = 10; // per signed-in uid

async function handleSubmitSupportTicket(req: any, res: any) {
  const { name, email, message } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "বার্তা লিখুন।" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "বার্তা অনেক বড়।" });
  }

  const uid = await resolveUid(req);

  const allowed = uid
    ? await checkAndBumpRateLimit(`support_${uid}`, USER_WINDOW_MS, USER_MAX)
    : await checkAndBumpRateLimit(`support_ip_${getClientIp(req)}`, GUEST_WINDOW_MS, GUEST_MAX);

  if (!allowed) {
    return res.status(429).json({
      error: "অনেকবার সাপোর্ট টিকেট পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }

  const { error: insertErr } = await supabaseAdmin.from("support_tickets").insert({
    name: (name || "").toString().slice(0, 200) || (uid ? "User" : "Anonymous"),
    email: (email || "").toString().slice(0, 200) || "anonymous@garibazar.com",
    message: message.trim().slice(0, 2000),
    user_id: uid || "guest",
    status: "open",
  });

  if (insertErr) {
    console.error("[account-actions/submit_support_ticket] insert error:", insertErr.message);
    return res.status(500).json({ error: "টিকেট জমা দেওয়া যায়নি।" });
  }

  return res.status(200).json({ success: true });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.body?.action;

  try {
    switch (action) {
      case "delete_account":
        return await handleDeleteAccount(req, res);
      case "report_listing":
        return await handleReportListing(req, res);
      case "toggle_sold":
        return await handleToggleSold(req, res);
      case "submit_support_ticket":
        return await handleSubmitSupportTicket(req, res);
      default:
        return res.status(400).json({ error: "Invalid action." });
    }
  } catch (err: any) {
    console.error(`[account-actions/${action}] failed:`, err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
}
