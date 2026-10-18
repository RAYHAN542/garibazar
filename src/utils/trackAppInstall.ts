import { Capacitor, registerPlugin } from "@capacitor/core";
import { apiUrl } from "./apiBase";
import { nativeFetch } from "./nativeFetch";

const DONE_KEY = "gb_app_install_v1";
const DEVICE_KEY = "gb_device_id";

const InstallReferrer = registerPlugin<{ getReferrer(): Promise<{ referrer?: string }> }>("InstallReferrer");

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY) || "";
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    const c: any = (globalThis as any).crypto;
    id =
      c && typeof c.randomUUID === "function"
        ? c.randomUUID()
        : Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16)
          ).join("");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function hadPreviousSession(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
  }
  return false;
}

// Reads the Play Install Referrer (max 4s). Older builds without the native
// plugin, or any failure, just resolve to an empty string.
async function readReferrer(): Promise<string> {
  try {
    const r = await Promise.race([
      InstallReferrer.getReferrer(),
      new Promise<{ referrer?: string }>((resolve) => setTimeout(() => resolve({}), 4000)),
    ]);
    return typeof r?.referrer === "string" ? r.referrer.slice(0, 300) : "";
  } catch {
    return "";
  }
}

// website / facebook / ... come from our own utm_source; Play's own default
// (utm_source=google-play) means the user found the app inside Play Store.
function sourceFromReferrer(ref: string): string {
  if (!ref) return "unknown";
  try {
    const s = new URLSearchParams(ref).get("utm_source");
    if (s) {
      const v = s.toLowerCase().slice(0, 40);
      return v === "google-play" ? "organic" : v;
    }
  } catch {
    // ignore
  }
  return "other";
}

// Counts a genuinely new Android app install once per device.
// Never throws; if the server does not confirm, it retries on the next open.
export async function trackAppInstall(): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) return;
    if (localStorage.getItem(DONE_KEY)) return;
    if (hadPreviousSession()) {
      // existing user who just updated the app -- not a new install
      localStorage.setItem(DONE_KEY, "existing");
      return;
    }
    const referrer = await readReferrer();
    const res = await nativeFetch(apiUrl("/api/track-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "app_install",
        deviceId: getDeviceId(),
        source: sourceFromReferrer(referrer),
        referrer,
      }),
    });
    const data: any = await res.json();
    if (data && data.ok === true && typeof data.counted === "boolean") {
      localStorage.setItem(DONE_KEY, data.counted ? "counted" : "duplicate");
    }
  } catch {
    // analytics must never break the app
  }
}
