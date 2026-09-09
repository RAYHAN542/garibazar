import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { applyCors } from "../_lib/cors.js";

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

// ---------------------------------------------------------------------------
// 🔧 Transition bridge for Google/Facebook login (Supabase OAuth).
//
// App.tsx's reviews/purchases/my-listings real-time listeners still read
// from Firestore and gate on Firebase's OWN auth session
// (onAuthStateChanged), not the Supabase session. Phone login already mints
// a matching Firebase custom token itself (see api/auth/phone.ts). Google/
// Facebook now authenticate entirely through Supabase's own OAuth redirect
// flow, so there's no equivalent server step for them -- this endpoint fills
// that gap: given a valid Supabase access token, it verifies the user and
// mints a Firebase custom token for that same uid, which AuthModal.tsx then
// uses to sign into Firebase too (bridgeFirebaseSession).
//
// Brand-new Google/Facebook sign-ups never had a legacy Firebase account, so
// their Supabase auth uid IS their app uid -- no user_auth_links mapping
// needed here (unlike the legacy-claim case in phone.ts).
//
// Safe to delete this whole file (and its call site in AuthModal.tsx) once
// App.tsx's remaining Firestore reads are migrated to Supabase.
// ---------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!supabaseAdmin || !getApps().length) {
    // Non-fatal by design: caller treats a missing token as "the old
    // Firestore-backed tabs just won't populate yet", not a login failure.
    return res.status(200).json({ firebaseToken: null });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) return res.status(401).json({ error: "Unauthorized" });

    const firebaseToken = await getAuth().createCustomToken(data.user.id);
    return res.status(200).json({ firebaseToken });
  } catch (err: any) {
    console.error("[firebase-bridge] failed:", err);
    return res.status(200).json({ firebaseToken: null });
  }
}
