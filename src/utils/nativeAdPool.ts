import { NativeAds, initNativeAds, resolveNativeUnit, isNativeAdsSupported } from "./nativeAds";

// Google native ad ~১ ঘণ্টা পর অকেজো হয়, তাই ৪৫ মিনিটের বেশি পুরনো ad ব্যবহার করি না
const MAX_AGE_MS = 45 * 60 * 1000;
let readyId: string | null = null;
let readyAt = 0;
let inflight: Promise<void> | null = null;
let counter = 0;

// No-fill backoff: after a failed load, don't send new ad requests for a while
// (2 -> 5 -> 15 -> 30 min). Resets on the first successful load.
const BACKOFF_MINUTES = [2, 5, 15, 30];
let failStreak = 0;
let blockedUntil = 0;
// শেষ আসল ব্যর্থতার কারণ (শুধু ডিবাগ বক্সে দেখানোর জন্য)
let lastLoadError = "";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** No fill হলে দ্রুত আবার চেষ্টা (০, ১.২ সেকেন্ড, ৩ সেকেন্ড)। সবগুলো ব্যর্থ হলে error ছোড়ে। */
export async function loadAdWithRetry(id: string, unit: string, isCancelled: () => boolean = () => false): Promise<void> {
  // Recent no-fill: skip the request entirely so AdMob isn't hammered.
  if (Date.now() < blockedUntil) {
    const mins = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));
    throw new Error("ad-backoff " + mins + "m" + (lastLoadError ? " (" + lastLoadError + ")" : ""));
  }
  // Healthy: one quick retry. After failures: a single attempt only.
  const waits = failStreak === 0 ? [0, 5000] : [0];
  let lastErr: unknown = null;
  let firstErr: unknown = null;
  for (const w of waits) {
    if (w) {
      await sleep(w);
      if (isCancelled()) return;
      await NativeAds.destroy({ id }).catch(() => {});
    }
    try {
      await NativeAds.load({ id, adUnitId: unit });
      failStreak = 0;
      blockedUntil = 0;
      lastLoadError = "";
      return;
    } catch (e) {
      if (!firstErr) firstErr = e;
      lastErr = e;
    }
  }
  const msgOf = (x: unknown) => String((x as { message?: string } | null)?.message ?? x);
  const m1 = msgOf(firstErr).slice(0, 110);
  const m2 = msgOf(lastErr).slice(0, 80);
  const combined = m1 === m2 ? m1 : "first: " + m1 + " >> then: " + m2;
  lastLoadError = combined.slice(0, 200);
  failStreak++;
  blockedUntil = Date.now() + BACKOFF_MINUTES[Math.min(failStreak - 1, BACKOFF_MINUTES.length - 1)] * 60 * 1000;
  throw new Error(combined);
}

function preload(): Promise<void> {
  if (!isNativeAdsSupported()) return Promise.resolve();
  if (readyId && Date.now() - readyAt < MAX_AGE_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      await initNativeAds();
      const unit = await resolveNativeUnit();
      const id = "pre-" + String(++counter);
      await loadAdWithRetry(id, unit);
      const old = readyId;
      readyId = id;
      readyAt = Date.now();
      if (old) NativeAds.destroy({ id: old }).catch(() => {});
    } catch {
      // ব্যর্থ হলে কিছু না, component নিজে লোড করবে
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** অ্যাপ খোলার একটু পরে প্রথম ad আগে থেকে লোড শুরু */
export function startAdPreload(): void {
  setTimeout(() => {
    void preload();
  }, 2500);
}

/** পরের ad আগে থেকে তৈরি রাখো */
export function kickPreload(): void {
  void preload();
}

/** তৈরি ad থাকলে তার id ফেরত দেয় (একবারই), না থাকলে null */
export async function claimPreloadedAd(): Promise<string | null> {
  if (inflight) await Promise.race([inflight, sleep(2500)]);
  if (readyId && Date.now() - readyAt < MAX_AGE_MS) {
    const id = readyId;
    readyId = null;
    return id;
  }
  return null;
}
