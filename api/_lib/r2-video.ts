import crypto from "crypto";

// ------------------------------------------------------------------------
// Cloudflare R2 presigned video upload helper.
//
// Lives in api/_lib (NOT a serverless function itself) and is called from
// api/cloudinary-sign.ts when the request body has kind === "video", so it
// does not count as an extra Vercel function (Hobby plan allows only 12).
//
// The caller has already verified the Supabase user (uid). This returns a
// short-lived (5 min) presigned PUT URL so the app uploads the video
// DIRECTLY to R2 (no video bytes pass through Vercel). The URL signs
// content-type AND content-length, so R2 itself rejects an upload whose
// type or size differs from what we approved here.
// No extra npm package: SigV4 query-string signing uses node crypto.
//
// Required Vercel env vars:
//   R2_ACCOUNT_ID, R2_BUCKET, R2_PUBLIC_URL,
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
// ------------------------------------------------------------------------

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

async function checkAndBumpRateLimit(supabaseAdmin: any, uid: string): Promise<boolean> {
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

// Called by api/cloudinary-sign.ts AFTER it has verified the user.
export async function handleVideoUpload(
  req: any,
  res: any,
  uid: string,
  supabaseAdmin: any
) {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({ error: "ভিডিও স্টোরেজ কনফিগার করা নেই (env var missing)।" });
    }

    const contentType = String(req.body?.contentType || "").toLowerCase();
    const size = Number(req.body?.size);
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) {
      return res.status(400).json({ error: "এই ধরনের ভিডিও সাপোর্ট করে না।" });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return res.status(400).json({ error: "ভিডিওটি বেশি বড়। আরও ছোট বা কম সময়ের ভিডিও দিন।" });
    }

    const allowed = await checkAndBumpRateLimit(supabaseAdmin, uid);
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
    console.error("[r2-video] error:", err?.message || err);
    return res.status(500).json({ error: "ভিডিও আপলোডের প্রস্তুতি ব্যর্থ হয়েছে।" });
  }
}

// Image upload to R2 (same presigned PUT as video).
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Called by api/cloudinary-sign.ts AFTER user + photo rate limit are checked.
export async function handleImageUpload(req: any, res: any, uid: string) {
  try {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
      return res.status(500).json({ error: "R2 কনফিগার করা নেই (env var missing)।" });
    }
    const contentType = String(req.body?.contentType || "").toLowerCase();
    const size = Number(req.body?.size);
    const ext = ALLOWED_IMAGE_TYPES[contentType];
    if (!ext) {
      return res.status(400).json({ error: "এই ধরনের ছবি সাপোর্ট করে না।" });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: "ছবিটি অনেক বড়।" });
    }
    let key = `images/${uid}/${crypto.randomUUID()}.${ext}`;
    // Thumbnail of an existing main image of THIS user: stored next to it as <name>-t.webp
    const thumbFor = req.body?.thumbFor;
    if (thumbFor !== undefined) {
      const mainKey = String(thumbFor).replace(publicUrl.replace(/\/$/, "") + "/", "");
      const okName = new RegExp("^images/" + uid + "/[0-9a-f-]{36}\\.webp$");
      if (contentType !== "image/webp" || size > 300 * 1024 || !okName.test(mainKey)) {
        return res.status(400).json({ error: "থাম্বনেইল সাপোর্ট করে না।" });
      }
      key = mainKey.replace(/\.webp$/, "-t.webp");
    }
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
    console.error("[r2-image] error:", err?.message || err);
    return res.status(500).json({ error: "ছবি আপলোডের প্রস্তুতি ব্যর্থ হয়েছে।" });
  }
}
