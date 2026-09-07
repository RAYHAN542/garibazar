import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// ---------------------------------------------------------------------------
// Shared rate limiter, backed by a Supabase Postgres RPC
// (check_and_bump_rate_limit) instead of a Firestore transaction -- same
// durable, atomic, per-instance-proof pattern, now on the app's primary
// database. All callers (get-seller-contact.ts, submit-support-ticket.ts,
// phone-signup/login, etc.) share this one function.
// ---------------------------------------------------------------------------
export async function checkAndBumpRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error("[rateLimit] Supabase admin client not configured -- failing open.");
    return true;
  }
  const { data, error } = await supabaseAdmin.rpc("check_and_bump_rate_limit", {
    p_key: key,
    p_window_ms: windowMs,
    p_max_count: max,
  });
  if (error) {
    console.error("[rateLimit] RPC failed -- failing open:", error.message);
    return true;
  }
  return !!data;
}

export function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}
