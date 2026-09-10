import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit, getClientIp } from "./_lib/rateLimit.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveCallerUid(token: string): Promise<string | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return data.user.id;
    } catch (e) {
      console.error("[submit-support-ticket] supabase token check failed:", e);
    }
  }
  return null;
}

// 🔧 FIX: cosmetic but worth fixing for consistency -- a migrated user's
// real app-wide uid (users.uid) is their legacy id, not the fresh Supabase
// Auth id their session carries. Doesn't block anything here (no ownership
// check gates this endpoint), but without this the ticket's stored user_id
// wouldn't match users.uid, so an admin cross-referencing "who filed this"
// would silently fail to find them.
async function resolveAppUid(authUid: string): Promise<string> {
  if (!supabaseAdmin) return authUid;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_auth_links")
      .select("app_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();
    if (error) throw error;
    return data?.app_uid || authUid;
  } catch (e) {
    console.error("[submit-support-ticket] app uid resolution failed, using auth uid:", e);
    return authUid;
  }
}

const GUEST_WINDOW_MS = 60 * 60 * 1000;
const GUEST_MAX = 3;
const USER_WINDOW_MS = 60 * 60 * 1000;
const USER_MAX = 10;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const { name, email, message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "বার্তা লিখুন।" });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "বার্তা অনেক বড়।" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    let uid: string | null = null;
    if (token) {
      const authUid = await resolveCallerUid(token);
      uid = authUid ? await resolveAppUid(authUid) : null;
    }

    const allowed = uid
      ? await checkAndBumpRateLimit(`support_${uid}`, USER_WINDOW_MS, USER_MAX)
      : await checkAndBumpRateLimit(`support_ip_${getClientIp(req)}`, GUEST_WINDOW_MS, GUEST_MAX);

    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার সাপোর্ট টিকেট পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    const { error: insertErr } = await supabaseAdmin.from("support_tickets").insert({
      user_id: uid || "guest",
      status: "open",
      data: {
        name: (name || "").toString().slice(0, 200) || (uid ? "User" : "Anonymous"),
        email: (email || "").toString().slice(0, 200) || "anonymous@garibazar.com",
        message: message.trim().slice(0, 2000),
      },
    });

    if (insertErr) {
      console.error("[submit-support-ticket] insert failed:", insertErr.message);
      return res.status(500).json({ error: "টিকেট জমা দেওয়া যায়নি। আবার চেষ্টা করুন।" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[submit-support-ticket] error:", err?.message || err);
    return res.status(500).json({ error: "টিকেট জমা দেওয়া যায়নি। আবার চেষ্টা করুন।" });
  }
}
