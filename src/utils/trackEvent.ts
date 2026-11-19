import { apiUrl } from "./apiBase";
import { nativeFetch } from "./nativeFetch";
import { getVisitDeviceId } from "./deviceId";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

// অ্যাপ ভার্সন একবারই পড়া হয় ("web" বা "1.2.3(45)"), ব্যর্থ হলে "unknown"।
let appVersionPromise: Promise<string> | null = null;
function getAppVersion(): Promise<string> {
  if (!appVersionPromise) {
    appVersionPromise = (async () => {
      try {
        if (!Capacitor.isNativePlatform()) return "web";
        const info = await CapApp.getInfo();
        return `${info.version}(${info.build})`;
      } catch {
        return "unknown";
      }
    })();
  }
  return appVersionPromise;
}

// Fire-and-forget visitor/login/signup analytics. This never blocks or
// throws -- if it fails for any reason (offline, ad-blocker, slow network)
// the app keeps working normally. `keepalive: true` lets the request finish
// even if the page navigates away right after this is called.
export function trackEvent(type: "visit" | "login" | "signup" | "install", uid?: string | null, identifier?: string | null) {
  try {
    const payload = {
      type,
      uid: uid || null,
      identifier: identifier || null,
      deviceId: getVisitDeviceId(),
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || "",
    };
    getAppVersion()
      .then((appVersion) =>
        nativeFetch(apiUrl("/api/track-event"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, appVersion }),
          keepalive: true,
        })
      )
      .catch(() => {});
  } catch {
    // ignore -- analytics should never break the app
  }
}
