import crypto from "crypto";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// Signs Cloudinary uploads server-side so the browser never uploads
// directly with a public unsigned preset. src/utils/cloudinary.ts calls
// this first (with the user's Supabase/Firebase token) to get a
// short-lived signature, proving the request came from a real logged-in
// user of this app, before uploading anything to Cloudinary.
// ------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 40; // signatures per user per hour

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
      console.error("[cloudinary-sign] supabase token check failed:", e);
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
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiKey || !apiSecret || !cloudName) {
      return res.status(500).json({ error: "Cloudinary কনফিগার করা নেই (env var missing)।" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }

    const callerUid = await resolveCallerUid(token);
    if (!callerUid) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }

    const allowed = await checkAndBumpRateLimit(`cloudinary_${callerUid}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    if (!allowed) {
      return res.status(429).json({ error: "অনেকবার ছবি আপলোডের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

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
