import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";

// ------------------------------------------------------------------------
// 🔧 (2026-09-25) "Report Ad" was writing directly to Firestore
// (listings/{id}.reportCount/reportedBy) via the client. Two problems:
// 1. Listings created after the Supabase migration don't exist in
//    Firestore at all, so getDoc() found nothing and the button silently
//    did nothing for any new listing.
// 2. Even for old Firestore listings, report_count/reported_by are in the
//    protected-columns list on the Supabase side (see
//    protect_listing_admin_fields trigger) -- a direct client update
//    there would have been rejected by RLS anyway. Reporting has to go
//    through a server endpoint using the service role, same pattern as
//    get-seller-contact.ts.
// ------------------------------------------------------------------------

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 20; // reports per user per hour -- generous for a genuine user flagging several bad posts, stops mass-reporting abuse.

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
    }

    let uid: string | null = await verifySupabaseToken(idToken);
    if (!uid && getApps().length) {
      try {
        const decoded = await getAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch {
        // fall through
      }
    }
    if (!uid) {
      return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "listingId প্রয়োজন।" });
    }

    const allowed = await checkAndBumpRateLimit(`report_listing_${uid}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    if (!allowed) {
      return res.status(429).json({ error: "অনেকবার রিপোর্ট করার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: listing, error: fetchErr } = await supabase
      .from("listings")
      .select("report_count, reported_by")
      .eq("id", listingId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[report-listing] fetch error:", fetchErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
    }
    if (!listing) {
      return res.status(404).json({ error: "লিস্টিং খুঁজে পাওয়া যায়নি।" });
    }

    const currentReportedBy: string[] = Array.isArray(listing.reported_by) ? listing.reported_by : [];
    if (currentReportedBy.includes(uid)) {
      // Already reported by this user -- treat as success (idempotent), no double-count.
      return res.status(200).json({ reported: true, alreadyReported: true });
    }

    const nextReportedBy = [...currentReportedBy, uid];
    const nextReportCount = (Number(listing.report_count) || 0) + 1;

    const { error: updateErr } = await supabase
      .from("listings")
      .update({ report_count: nextReportCount, reported_by: nextReportedBy })
      .eq("id", listingId);

    if (updateErr) {
      console.error("[report-listing] update error:", updateErr.message);
      return res.status(500).json({ error: "রিপোর্ট সাবমিট করা যায়নি।" });
    }

    return res.status(200).json({ reported: true });
  } catch (err: any) {
    console.error("[report-listing] error:", err?.message || err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
}
