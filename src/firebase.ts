import { logger } from "./utils/logger";
import { supabase } from "./supabase";

// 🔧 Firebase → Supabase migration complete: Auth, Firestore, App Check,
// and Storage are no longer used anywhere in the client (verified: nothing
// imports `auth`, `db`, or `storage` from this file anymore -- every
// component now uses Supabase directly). This file is kept only for
// logAnalyticsEvent, which now writes straight to Supabase's site_visits
// table instead of going through Firebase Analytics or a serverless
// endpoint.
export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  logger.debug(`Analytics Event: ${eventName}`, eventParams);

  // Only real page visits / login / signup are worth a row here. Click-level
  // events (search, listing_view, select_category, ...) just get the
  // console.debug log above and stop there.
  if (eventName !== "login" && eventName !== "signup" && eventName !== "visit") {
    return;
  }

  supabase
    .from("site_visits")
    .insert({
      type: eventName,
      uid: eventParams?.uid || null,
      identifier: eventParams?.identifier || null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })
    .then(({ error }) => {
      if (error) logger.debug("site_visits insert failed:", error.message);
    });
};
