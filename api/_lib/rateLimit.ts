import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// 🔧 (2026-09-25) Migrated off Firestore -- this was the last thing still
// pulling firebase-admin into several API routes (get-seller-contact, draw,
// submit-support-ticket/account-actions, track-event) purely for this one
// shared helper, well after their actual auth/data logic had already moved
// to Supabase. Now backed by Supabase's `rate_limits` table via the
// check_and_bump_rate_limit() Postgres function, which does the same
// atomic "read window, reset-or-increment, write back" as a single
// SECURITY DEFINER upsert -- no client-side read-then-write race, same
// guarantee the old Firestore transaction gave.
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase server credentials are not configured");
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

export async function checkAndBumpRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin().rpc("check_and_bump_rate_limit", {
    p_key: key,
    p_window_ms: windowMs,
    p_max_count: max,
  });
  if (error) {
    // Fail open rather than block real users if the rate limiter itself is
    // down -- same posture the old Firestore version had (an unhandled
    // exception there would have surfaced as a 500, not a silent block).
    console.error("checkAndBumpRateLimit error:", error);
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
