import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { applyCors } from "./_lib/cors.js";

// ------------------------------------------------------------------------
// Signs Cloudinary uploads server-side so the browser never uploads
// directly with a public unsigned preset. src/utils/cloudinary.ts calls
// this first (with the user's Supabase access token) to get a short-lived
// signature, proving the request came from a real logged-in user of this
// app, before uploading anything to Cloudinary.
//
// 🔧 Firebase -> Supabase migration: login is now 100% Supabase Auth (phone
// signup/login never touches Firebase at all), so auth.currentUser was
// always null and getIdToken() always failed -- every photo upload for a
// phone-registered user broke at the very first step with a generic
// "Photo upload failed" message. Swapped the Firebase Admin ID-token check
// for supabase.auth.getUser(accessToken), which validates a Supabase JWT
// the same way.
//
// Required Cloudinary Console setup (cannot be done from code):
//   1. Dashboard -> Settings -> Access Keys: copy the API Key + API Secret.
//   2. Set these as Vercel environment variables (Project Settings ->
//      Environment Variables), NOT in any client-side file:
//        CLOUDINARY_API_KEY
//        CLOUDINARY_API_SECRET
//        CLOUDINARY_CLOUD_NAME   (e.g. "dpihzqpdi", already used elsewhere)
// ------------------------------------------------------------------------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 40; // signatures per user per hour -- generous for
// normal listing/photo uploads, but stops a compromised/scripted account
// from hammering Cloudinary storage quota.

// Postgres-backed (check_and_bump_rate_limit RPC), same function already
// used by api/auth/phone.ts -- persists across serverless invocations,
// unlike an in-memory Map, and now lives in one place instead of a
// per-endpoint Firestore collection.
async function checkAndBumpRateLimit(uid: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_and_bump_rate_limit", {
    p_key: `cloudinary_${uid}`,
    p_window_ms: RATE_LIMIT_WINDOW_MS,
    p_max_count: RATE_LIMIT_MAX,
  });
  if (error) {
    console.error("rate limit RPC failed, failing open:", error);
    return true; // rate-limiter নিজেই ভেঙে গেলে আপলোড ব্লক করে দেওয়া ঠিক না
  }
  return data === true;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiKey || !apiSecret || !cloudName) {
      return res.status(500).json({ error: "Cloudinary কনফিগার করা নেই (env var missing)।" });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    // Only a signed-in user of this app may request a signature -- this is
    // the actual guard that unsigned uploads don't have.
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.replace("Bearer ", "");
    if (!accessToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
    }
    const uid = userData.user.id;

    const allowed = await checkAndBumpRateLimit(uid);
    if (!allowed) {
      return res.status(429).json({ error: "অনেকবার ছবি আপলোডের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

    // Cloudinary's signing rule: sign every param that will be sent with the
    // upload (sorted alphabetically), plus the API secret, with SHA-1.
    // Keep this in sync with whatever params the client actually sends.
    //
    // allowed_formats: rejects SVG (can embed scripts) and any non-image
    // format outright, even if a caller bypasses our own client code and
    // hits Cloudinary directly with a valid signature.
    // folder: every user's uploads land in their own folder instead of the
    // account root, so storage is attributable per user and one user's
    // upload can never collide with / overwrite another's by name.
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = {
      timestamp,
      upload_preset: "gari_bazar_preset",
      folder: `listings/${uid}`,
      allowed_formats: "jpg,png,webp",
    };
    const toSign = Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join("&");
    const signature = crypto
      .createHash("sha1")
      .update(toSign + apiSecret)
      .digest("hex");

    return res.status(200).json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: paramsToSign.folder,
      allowedFormats: paramsToSign.allowed_formats,
    });
  } catch (err: any) {
    console.error("[cloudinary-sign] error:", err?.message || err);
    return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
  }
}
