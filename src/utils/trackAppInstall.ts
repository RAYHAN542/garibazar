import { Capacitor } from "@capacitor/core";
import { apiUrl } from "./apiBase";
import { nativeFetch } from "./nativeFetch";

const DONE_KEY = "gb_app_install_v1";
const DEVICE_KEY = "gb_device_id";

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
    const res = await nativeFetch(apiUrl("/api/track-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "app_install", deviceId: getDeviceId() }),
    });
    const data: any = await res.json();
    if (data && data.ok === true && typeof data.counted === "boolean") {
      localStorage.setItem(DONE_KEY, data.counted ? "counted" : "duplicate");
    }
  } catch {
    // analytics must never break the app
  }
}
