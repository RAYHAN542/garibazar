import { registerPlugin } from "@capacitor/core";
import { NativeAds, initNativeAds, isNativeAdsSupported } from "./nativeAds";

interface InterstitialAdsPlugin {
  load(options: { adUnitId: string }): Promise<{ loaded: boolean; error?: string }>;
  show(): Promise<{ shown: boolean }>;
}

const InterstitialAds = registerPlugin<InterstitialAdsPlugin>("InterstitialAds");

// Google-এর অফিশিয়াল test Interstitial Video ইউনিট
const TEST_INTERSTITIAL_UNIT = "ca-app-pub-3940256099942544/8691691433";
// AdMob-এ Interstitial ইউনিট বানিয়ে এখানে ID বসাতে হবে (অথবা VITE_ADMOB_INTERSTITIAL_UNIT)।
// খালি থাকলে সবসময় test ad চলবে, তাই ভুল করে আসল ad-এ ক্লিকের ঝুঁকি নেই।
const LIVE_INTERSTITIAL_UNIT: string = (import.meta.env.VITE_ADMOB_INTERSTITIAL_UNIT as string) || "";

let unitPromise: Promise<string> | null = null;

function resolveInterstitialUnit(): Promise<string> {
  if (!unitPromise) {
    unitPromise = (async () => {
      if (!LIVE_INTERSTITIAL_UNIT) return TEST_INTERSTITIAL_UNIT;
      try {
        const r = await NativeAds.installSource();
        return r.fromPlayStore ? LIVE_INTERSTITIAL_UNIT : TEST_INTERSTITIAL_UNIT;
      } catch {
        return TEST_INTERSTITIAL_UNIT;
      }
    })();
  }
  return unitPromise;
}

/** ad আগে থেকে লোড করে রাখে। ব্যর্থ হলে চুপচাপ ফেরত আসে। */
export async function preloadInterstitial(): Promise<void> {
  if (!isNativeAdsSupported()) return;
  try {
    await initNativeAds();
    const adUnitId = await resolveInterstitialUnit();
    await InterstitialAds.load({ adUnitId });
  } catch {
    /* ignore */
  }
}

/** ad দেখায়। ad বন্ধ/skip হলে true, ad না থাকলে বা ব্যর্থ হলে false। */
export async function showInterstitial(): Promise<boolean> {
  if (!isNativeAdsSupported()) return false;
  try {
    const r = await InterstitialAds.show();
    return !!r.shown;
  } catch {
    return false;
  }
}
