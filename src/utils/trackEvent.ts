// Fire-and-forget visitor/login/signup analytics. This never blocks or
// throws -- if it fails for any reason (offline, ad-blocker, slow network)
// the app keeps working normally. `keepalive: true` lets the request finish
// even if the page navigates away right after this is called.
export function trackEvent(type: "visit" | "login" | "signup", uid?: string | null) {
  try {
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        uid: uid || null,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || "",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore -- analytics should never break the app
  }
}
