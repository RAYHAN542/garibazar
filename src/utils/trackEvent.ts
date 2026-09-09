import { supabase } from "../supabase";

// Fire-and-forget visitor/login/signup analytics, written directly to
// Supabase's site_visits table (INSERT-only for anon/authenticated via RLS,
// can't be read back from the client). Replaces the old api/track-event.ts
// serverless call, which was removed to stay under Vercel's Hobby-plan
// 12-function limit.
export function trackEvent(
  type: "visit" | "login" | "signup" | "install",
  uid?: string | null,
  identifier?: string | null
) {
  try {
    supabase
      .from("site_visits")
      .insert({
        type,
        uid: uid || null,
        identifier: identifier || null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      })
      .then(() => {});
  } catch (_) {
    // never throw -- this must never break the app
  }
}
