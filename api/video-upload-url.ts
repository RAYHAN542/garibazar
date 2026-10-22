import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { applyCors } from "./_lib/cors.js";

// ------------------------------------------------------------------------
// Gives a logged-in seller a short-lived (5 min) presigned URL so the app
// can upload a listing video DIRECTLY to Cloudflare R2 (no video bytes pass
// through Vercel). Same auth + rate-limit pattern as api/cloudinary-sign.ts.
//
// The presigned URL signs content-type AND content-length, so R2 itself
// rejects an upload whose type or size differs from what we approved here.
// No extra npm package: SigV4 query-string signing is done with node crypto.
//
// Required Vercel env vars (set in Project Settings -> Environment Variables):
//   R2_ACCOUNT_ID, R2_BUCKET, R2_PUBLIC_URL,
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
// ------------------------------------------------------------------------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // video uploads per user per hour

// Hidden hard cap. The app compresses to ~15 MB before uploading; users are
// only ever told "max 20 seconds", never an MB number.
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

async function checkAndBumpRateLimit(uid: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_and_bump_rate_limit", {
    p_key: `video_${uid}`,
    p_window_ms: RATE_LIMIT_WINDOW_MS,
    p_max_count: RATE_LIMIT_MAX,
  });
  if (error) {
    console.error("rate limit RPC failed, failing open:", error);
    return true;
  }
  return data === true;
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}
function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function presignPut(opts: {
  accountId: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  contentType: string;
  contentLength: number;
  expiresSeconds: number;
}): string {
  const host = `${opts.accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri =
    "/" + [opts.bucket, ...opts.key.split("/")].map(rfc3986).join("/");

  const signedHeaders = "content-length;content-type;host";
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${opts.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(opts.expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`)
    .join("&");

  const canonicalHeaders =
    `content-length:${opts.contentLength}\n` +
    `content-type:${opts.contentType}\n` +
    `host:${host}\n`;

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + opts.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({ error: "ভিডিও স্টোরেজ কনফিগার করা নেই (env var missing)।" });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    // Only a signed-in user of this app may upload.
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

    const contentType = String(req.body?.contentType || "").toLowerCase();
    const size = Number(req.body?.size);
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) {
      return res.status(400).json({ error: "এই ধরনের ভিডিও সাপোর্ট করে না।" });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return res.status(400).json({ error: "ভিডিওটি বেশি বড়। আরও ছোট বা কম সময়ের ভিডিও দিন।" });
    }

    const allowed = await checkAndBumpRateLimit(uid);
    if (!allowed) {
      return res.status(429).json({ error: "অনেকবার ভিডিও আপলোডের চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

    const key = `videos/${uid}/${crypto.randomUUID()}.${ext}`;
    const uploadUrl = presignPut({
      accountId,
      bucket,
      key,
      accessKeyId,
      secretAccessKey,
      contentType,
      contentLength: Math.floor(size),
      expiresSeconds: 300,
    });

    return res.status(200).json({
      uploadUrl,
      publicUrl: `${publicUrl.replace(/\/$/, "")}/${key}`,
      key,
      contentType,
    });
  } catch (err: any) {
    console.error("[video-upload-url] error:", err?.message || err);
    return res.status(500).json({ error: "ভিডিও আপলোডের প্রস্তুতি ব্যর্থ হয়েছে।" });
  }
}
