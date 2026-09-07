import { apiUrl } from "./apiBase";

// Fire-and-forget visitor/login/signup analytics. This never blocks or
// throws -- if it fails for any reason (offline, ad-blocker, slow network)
// the app keeps working normally. `keepalive: true` lets the request finish
// even if the page navigates away right after this is called.
export function trackEvent(_type: "visit" | "login" | "signup" | "install", _uid?: string | null, _identifier?: string | null) {
  // api/track-event.ts removed (Vercel 12-function limit)
}
