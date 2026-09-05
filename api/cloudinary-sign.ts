import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { applyCors } from "./_lib/cors.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// Signs Cloudinary uploads server-side so the browser never uploads
// directly with a public unsigned preset. src/utils/cloudinary.ts calls
// this first (with the user's Firebase ID token) to get a short-lived
// signature, proving the request came from a real logged-in user of this
// app, before uploading anything to Cloudinary.
//
// Required Cloudinary Console setup (cannot be done from code):
//   1. Dashboard -> Settings -> Access Keys: copy the API Key + API Secret.
//   2. Set these as Vercel environment variables (Project Settings ->
//      Environment Variables), NOT in any client-side file:
//        CLOUDINARY_API_KEY
//        CLOUDINARY_API_SECRET
//        CLOUDINARY_CLOUD_NAME   (e.g. "dpihzqpdi", already used elsewhere)
// ------------------------------------------------------------------------

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

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 40; // signatures per user per hour -- generous for
// normal listing/photo uploads, but stops a compromised/scripted account
// from hammering Cloudinary storage quota.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// Was: any signed-in user could request an unlimited number of signatures,
// each good for one real upload -- a single account (or a stolen token)
// could burn through Cloudinary's free-tier storage/bandwidth in minutes.
// Now: a per-user counter in Firestore (persists across serverless
// invocations, unlike an in-memory Map) caps requests to RATE_LIMIT_MAX per
// rolling hour.
async function checkAndBumpRateLimit(uid: string): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection("rate_limits").doc(`cloudinary_${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    const data = snap.data() as { count: number; windowStart: number };
    if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= RATE_LIMIT_MAX) {
      return false;
    }
    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
}

async function checkAndBumpSupabaseRateLimit(uid: string): Promise<boolean> {
  if (!supabaseAdmin) return true;
  const key = `cloudinary_${uid}`;
  const now = new Date();
  const { data } = await supabaseAdmin.from("rate_limits").select("*").eq("key", key).maybeSingle();
  if (!data || now.getTime() - new Date(data.window_start).getTime() > RATE_LIMIT_WINDOW_MS) {
    await supabaseAdmin.from("rate_limits").upsert({ key, count: 1, window_start: now.toISOString() });
    return true;
  }
  const newCount = (data.count || 0) + 1;
  await supabaseAdmin.from("rate_limits").update({ count: newCount }).eq("key", key);
  return newCount <= RATE_LIMIT_MAX;
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

    // Only a signed-in user of this app may request a signature -- this is
    // the actual guard that unsigned uploads don't have.
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    // Phone/password users carry a Supabase access token; older Firebase
    // social-login users still carry a Firebase ID token.
    let callerUid: string | null = null;
    let usesSupabaseAuth = false;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.getUser(idToken);
      if (!error && data?.user?.id) {
        callerUid = data.user.id;
        usesSupabaseAuth = true;
      }
    }
    if (!callerUid) {
      const decoded = await getAuth().verifyIdToken(idToken);
      callerUid = decoded.uid;
    }

    const allowed = usesSupabaseAuth
      ? await checkAndBumpSupabaseRateLimit(callerUid)
      : await checkAndBumpRateLimit(callerUid);
    if (!allowed) {
      return res.status(429).json({ error: "অনেকবার ছবি আপলোডের চে঵্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
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
      folder: `listings/${callerUid}`,
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
