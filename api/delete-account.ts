import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { applyCors } from "./_lib/cors.js";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveCallerUid(token: string): Promise<{ uid: string; firebaseUid?: string } | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return { uid: data.user.id };
    } catch (e) {
      console.error("[delete-account] supabase token check failed:", e);
    }
  }
  if (getApps().length) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return { uid: decoded.uid, firebaseUid: decoded.uid };
    } catch (e) {
      console.error("[delete-account] firebase token check failed:", (e as any)?.message || e);
    }
  }
  return null;
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
    const { uid, firebaseUid } = resolved;

    // 1. Delete listings owned by this user.
    await supabaseAdmin.from("listings").delete().eq("seller_id", uid);

    // 2. Delete profile records.
    await supabaseAdmin.from("public_profiles").delete().eq("uid", uid);
    await supabaseAdmin.from("users").delete().eq("uid", uid);

    // 3. Delete the Supabase auth user itself.
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (authDelErr) {
      console.error("[delete-account] supabase auth delete failed:", authDelErr.message);
    }

    // 4. Best-effort: also remove the legacy Firebase auth record, if one
    // still exists for this person from before the Supabase migration.
    if (firebaseUid && getApps().length) {
      try {
        await getAuth().deleteUser(firebaseUid);
      } catch (e) {
        // Not fatal -- Firebase side is legacy/best-effort only.
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[delete-account] failed:", err);
    return res.status(500).json({ error: "অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে।" });
  }
}
