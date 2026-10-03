import { logger } from "./logger";
import { apiUrl } from "./apiBase";

export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  logger.debug(`Analytics Event: ${eventName}`, eventParams);

  // Only real page visits / login / signup are worth 2 Firestore writes
  // (site_visits.add + analytics_stats/summary increment) each. Click-level
  // events (search, listing_view, select_category, select_location,
  // contact_seller_click, ad_promote, seller_review_submitted, ...) were
  // previously ALSO being sent here and silently relabeled "visit" -- costing
  // 2 extra Firestore writes per click for no benefit, since the admin panel
  // only ever distinguishes "login" / "signup" / generic "visit" anyway.
  // Those events still get the console.debug log above; they just no longer
  // hit Firestore.
  if (eventName !== "login" && eventName !== "signup" && eventName !== "visit") {
    return;
  }

  const type = eventName === "login" ? "login" : eventName === "signup" ? "signup" : "visit";
  try {
    fetch(apiUrl("/api/track-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        uid: eventParams?.uid || null,
        identifier: eventParams?.identifier || null,
        path: typeof window !== "undefined" ? window.location.pathname : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
    }).catch((err) => logger.debug("track-event call failed:", err));
  } catch (err) {
    logger.debug("track-event call failed:", err);
  }
};
