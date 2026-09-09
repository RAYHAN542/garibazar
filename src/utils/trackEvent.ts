import { supabase } from "../supabase";

// ---------------------------------------------------------------------------
// Fire-and-forget visitor/login/signup/install analytics.
//
// 🔧 Firebase -> Supabase migration: this used to POST to api/track-event.ts,
// which was later deleted entirely to stay under Vercel's free-tier 12
// serverless-function limit -- so every call here silently did nothing, and
// the admin panel's "Visitor & Login Analytics" (Total Visits/Logins/New
// Signups/App Installs, Recent Visit Log) always showed 0 / empty.
//
// Fix: write directly to Supabase's `site_visits` table from the browser
// instead of through a backend endpoint -- no serverless function needed at
// all, so it doesn't compete for Vercel's function-count limit. RLS on that
// table only allows inserting the 4 known event types and restricts reads to
// admins (see site_visits_insert_anyone / site_visits_admin_read policies).
//
// Trade-off: without a backend request, we lose Vercel's IP-based geo
// headers (city/region/country/isp) that the old Firestore version had --
// those columns are simply left null here. If that geo data is wanted back
// later, it needs a dedicated small endpoint (or a Supabase Edge Function)
// that reads the request's IP; not worth reintroducing a Vercel serverless
// function just for analytics.
//
// This never blocks or throws -- if it fails for any reason (offline,
// ad-blocker, RLS rejection) the app keeps working normally.
// ---------------------------------------------------------------------------
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
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      })
      .then(({ error }) => {
        if (error) console.warn("trackEvent insert failed (non-fatal):", error.message);
      });
  } catch (e) {
    // fire-and-forget: কখনোই app-কে ব্লক বা crash করানো ঠিক না
    console.warn("trackEvent failed (non-fatal):", e);
  }
}
