import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeAdsPlugin {
  initialize(options?: { testDeviceIds?: string[] }): Promise<void>;
  installSource(): Promise<{ fromPlayStore: boolean; installer: string }>;
  load(options: { id: string; adUnitId: string }): Promise<void>;
  show(options: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    clipTop?: number;
    clipBottom?: number;
  }): Promise<void>;
  hide(options: { id: string }): Promise<void>;
  destroy(options: { id: string }): Promise<void>;
}

export const NativeAds = registerPlugin<NativeAdsPlugin>("NativeAds");

/** শুধু Android অ্যাপে true। ওয়েবসাইটে কখনো না (সেখানে AdSense চলে)। */
export const isNativeAdsSupported = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const TEST_NATIVE_UNIT = "ca-app-pub-3940256099942544/2247696110";
const LIVE_NATIVE_UNIT = "ca-app-pub-1085596401571838/3337709776";

export const IS_TEST_UNIT = (unit: string): boolean => unit === TEST_NATIVE_UNIT;

let unitPromise: Promise<string> | null = null;

/**
 * আসল (live) ইউনিট শুধু তখনই যখন অ্যাপ Play Store থেকে ইনস্টল।
 * sideload করা APK-তে সবসময় Google-এর test ইউনিট -- নিজের ফোনে আসল ad-এ ক্লিকের ঝুঁকি নেই।
 */
export function resolveNativeUnit(): Promise<string> {
  if (!unitPromise) {
    unitPromise = (async () => {
      try {
        const r = await NativeAds.installSource();
        return r.fromPlayStore ? LIVE_NATIVE_UNIT : TEST_NATIVE_UNIT;
      } catch {
        return TEST_NATIVE_UNIT;
      }
    })();
  }
  return unitPromise;
}

let initPromise: Promise<void> | null = null;

export function initNativeAds(): Promise<void> {
  if (!initPromise) {
    initPromise = NativeAds.initialize({
      testDeviceIds: String(import.meta.env.VITE_ADMOB_TEST_DEVICES || "").split(",").map((x: string) => x.trim()).filter(Boolean),
    }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
