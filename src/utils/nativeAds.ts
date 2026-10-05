import { Capacitor, registerPlugin } from "@capacitor/core";

export interface NativeAdsPlugin {
  initialize(options?: { testDeviceIds?: string[] }): Promise<void>;
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

/** ডিফল্ট = Google-এর টেস্ট ad ইউনিট। আসল ইউনিট শুধু বিল্ডে VITE_ADMOB_LIVE=true দিলে। */
export const NATIVE_FEED_UNIT: string =
  import.meta.env.VITE_ADMOB_LIVE === "true" ? LIVE_NATIVE_UNIT : TEST_NATIVE_UNIT;

let initPromise: Promise<void> | null = null;

export function initNativeAds(): Promise<void> {
  if (!initPromise) {
    initPromise = NativeAds.initialize({}).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
