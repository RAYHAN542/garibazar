import { NativeAds, initNativeAds, resolveNativeUnit, isNativeAdsSupported } from "./nativeAds";

// Google native ad ~১ ঘণ্টা পর অকেজো হয়, তাই ৪৫ মিনিটের বেশি পুরনো ad ব্যবহার করি না
const MAX_AGE_MS = 45 * 60 * 1000;
let readyId: string | null = null;
let readyAt = 0;
let inflight: Promise<void> | null = null;
let counter = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** No fill হলে দ্রুত আবার চেষ্টা (০, ১.২ সেকেন্ড, ৩ সেকেন্ড)। সবগুলো ব্যর্থ হলে error ছোড়ে। */
export async function loadAdWithRetry(id: string, unit: string, isCancelled: () => boolean = () => false): Promise<void> {
  const waits = [0, 1200, 3000];
  let lastErr: unknown = null;
  for (const w of waits) {
    if (w) {
      await sleep(w);
      if (isCancelled()) return;
      await NativeAds.destroy({ id }).catch(() => {});
    }
    try {
      await NativeAds.load({ id, adUnitId: unit });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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
