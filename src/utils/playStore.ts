import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabase";

const PKG = "shop.garibazar.twa";
const VISITOR_KEY = "gb_visitor_id";

// Play Store link; the referrer lets Play Console show website-driven installs.
export function playStoreUrl(medium: string): string {
  // The profile button builds its URL inside its onClick (not at render time),
  // so this is the one place its click can be counted. The banner strip and
  // popup are plain <a> links and are counted by the click listener below.
  if (medium === "profile_button") trackPlayClick(medium);
  const ref = encodeURIComponent(`utm_source=website&utm_medium=${medium}`);
  return `https://play.google.com/store/apps/details?id=${PKG}&referrer=${ref}`;
}

function getVisitorId(): string {
  let id = "";
  try {
    id = localStorage.getItem(VISITOR_KEY) || "";
    if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      const c: any = (globalThis as any).crypto;
      id =
        c && typeof c.randomUUID === "function"
          ? c.randomUUID()
          : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      localStorage.setItem(VISITOR_KEY, id);
    }
  } catch {
    id = "";
  }
  return id;
}

// Counts a tap on a website "install from Google Play" button (once per
// visitor per button per day). Independent of the Play Install Referrer, which
// Facebook's in-app browser overwrites. Never throws.
export function trackPlayClick(medium: string): void {
  try {
    const visitor = getVisitorId();
    if (!visitor) return;
    void Promise.resolve(supabase.rpc("log_play_click", { p_medium: medium, p_visitor: visitor })).catch(() => {});
  } catch {
    // analytics must never break the page
  }
}

if (typeof document !== "undefined") {
  const w = window as any;
  if (!w.__gbPlayClickListener) {
    w.__gbPlayClickListener = true;
    document.addEventListener(
      "click",
      (e) => {
        try {
          const a = (e.target as Element | null)?.closest?.("a");
          const href = a?.getAttribute("href") || "";
          if (!href.includes("play.google.com/store/apps/details") || !href.includes(PKG)) return;
          const ref = new URL(href, window.location.href).searchParams.get("referrer") || "";
          const medium = new URLSearchParams(ref).get("utm_medium");
          if (medium && medium !== "profile_button") trackPlayClick(medium);
        } catch {
          // ignore
        }
      },
      true
    );
  }
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
