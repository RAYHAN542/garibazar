import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";

// Records that a boosted listing was actually shown to a visitor, so the
// fair-rotation logic (src/utils/adRotation.ts) can always pick whichever
// live ads have been shown the LEAST -- true fairness no matter how many
// ads are boosted at once (100 or 100,000), no client-side reload-guessing
// needed. Public/anonymous (no login required, same as a page view), but
// rate-limited per IP and capped per request so it can't be abused to
// inflate/deflate specific listings' counts.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MAX_IDS_PER_CALL = 10;

function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!supabaseAdmin) {
    // Best-effort feature -- never break the homepage over missing config.
    res.status(200).json({ ok: false });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = Array.from(new Set(rawIds.filter((id: any) => typeof id === "string" && UUID_RE.test(id)))).slice(
      0,
      MAX_IDS_PER_CALL
    );
    if (ids.length === 0) {
      res.status(200).json({ ok: true, counted: 0 });
      return;
    }

    const ip = getClientIp(req);
    // One impression-report call per IP per few seconds is plenty (one per
    // homepage load) -- this only guards against a broken client looping,
    // not normal browsing.
    const allowed = await checkAndBumpRateLimit(`ad_impression_${ip}`, 5_000, 3);
    if (!allowed) {
      res.status(200).json({ ok: true, counted: 0, skipped: true });
      return;
    }

    const { error } = await supabaseAdmin.rpc("bump_ad_impressions", { p_ids: ids });
    if (error) {
      console.error("bump_ad_impressions error:", error.message);
      res.status(200).json({ ok: false });
      return;
    }
    res.status(200).json({ ok: true, counted: ids.length });
  } catch (e) {
    console.error("ad-impression error:", e);
    res.status(200).json({ ok: false });
  }
}
