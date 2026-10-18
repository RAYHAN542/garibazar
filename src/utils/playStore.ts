import { Capacitor } from "@capacitor/core";

const PKG = "shop.garibazar.twa";

// Play Store link; the referrer lets Play Console show website-driven installs.
export function playStoreUrl(medium: string): string {
  const ref = encodeURIComponent(`utm_source=website&utm_medium=${medium}`);
  return `https://play.google.com/store/apps/details?id=${PKG}&referrer=${ref}`;
}

// True only for Android phones browsing the website (not inside the app,
// not an already-installed PWA, not iPhone/desktop).
export function isAndroidWeb(): boolean {
  try {
    if (typeof navigator === "undefined") return false;
    if (Capacitor.isNativePlatform()) return false;
    if (!/Android/i.test(navigator.userAgent)) return false;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return false;
    return true;
  } catch {
    return false;
  }
}
