import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_lib/cors.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveCallerUid(token: string): Promise<{ authUid: string } | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return { authUid: data.user.id };
    } catch (e) {
      console.error("[delete-account] supabase token check failed:", e);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 🔧 FIX: a migrated ("restore old account") user's real app-wide uid
// (listings.seller_id, users.uid, public_profiles.uid, etc.) is their OLD
// legacy id, not the fresh Supabase Auth id minted for their new login --
// RLS's own current_uid() function resolves this via user_auth_links, but
// this endpoint was deleting rows using the raw Supabase auth id directly.
// For any migrated account, that meant their actual listings/profile rows
// (still keyed by the legacy uid) were silently left behind -- Delete
// Account reported success without deleting the real data, a genuine
// privacy/Play-Store-compliance gap, not just a display bug.
// ---------------------------------------------------------------------------
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
    console.error("[delete-account] app uid resolution failed, using auth uid:", e);
    return authUid;
  }
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
    if (!token) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const resolved = await resolveCallerUid(token);
    if (!resolved) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const { authUid } = resolved;
    const appUid = await resolveAppUid(authUid);

    // 1. Delete listings owned by this user (app uid -- e.g. seller_id).
    await supabaseAdmin.from("listings").delete().eq("seller_id", appUid);

    // 2. Delete profile records (also app uid).
    await supabaseAdmin.from("public_profiles").delete().eq("uid", appUid);
    await supabaseAdmin.from("users").delete().eq("uid", appUid);

    // 2b. Clean up the auth_uid -> app_uid mapping itself, if any.
    await supabaseAdmin.from("user_auth_links").delete().eq("auth_uid", authUid);

    // 3. Delete the Supabase auth user itself (this is always the raw auth
    // uid -- that's what auth.users is keyed by, never the legacy app uid).
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUid);
    if (authDelErr) {
      console.error("[delete-account] supabase auth delete failed:", authDelErr.message);
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[delete-account] failed:", err);
    return res.status(500).json({ error: "অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে।" });
  }
}
