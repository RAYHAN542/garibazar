import { Capacitor, registerPlugin } from "@capacitor/core";

interface GariReviewPlugin {
  request(): Promise<void>;
}

// Google Play in-app rating sheet (shown to everyone, Google decides if it can show).
const OPEN_KEY = "gb_open_count";
const LAST_KEY = "gb_review_last";
const MIN_OPENS = 5;
const GAP_MS = 45 * 24 * 60 * 60 * 1000;
const DELAY_MS = 30_000;

const isAvailable = (): boolean => {
  try {
    return Capacitor.isPluginAvailable("GariReview");
  } catch (_) {
    return false;
  }
};

const GariReview = registerPlugin<GariReviewPlugin>("GariReview");

function readNum(k: string): number {
  try {
    return Number(localStorage.getItem(k)) || 0;
  } catch (_) {
    return 0;
  }
}

function writeNum(k: string, n: number): void {
  try {
    localStorage.setItem(k, String(n));
  } catch (_) {}
}

if (typeof window !== "undefined" && isAvailable()) {
  const opens = readNum(OPEN_KEY) + 1;
  writeNum(OPEN_KEY, opens);
  if (opens >= MIN_OPENS && Date.now() - readNum(LAST_KEY) > GAP_MS) {
    window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      writeNum(LAST_KEY, Date.now());
      void GariReview.request().catch(() => {});
    }, DELAY_MS);
  }
}
