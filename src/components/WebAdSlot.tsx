import { useEffect, useRef } from "react";
import { isNativeAdsSupported } from "../utils/nativeAds";

const CLIENT = "ca-pub-3277203446788826";
const SLOT = (import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined;

/** শুধু ওয়েবসাইটে AdSense দেখায়। অ্যাপে (AdMob আছে) বা slot না থাকলে কিছু রেন্ডার করে না। */
export function WebAdSlot() {
  const pushed = useRef(false);
  const native = isNativeAdsSupported();
  const enabled = !native && !!SLOT;

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      const w = window as any;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="col-span-full my-2 overflow-hidden rounded-xl" style={{ minHeight: 100 }}>
      <span className="mb-0.5 block text-[10px] text-slate-400">বিজ্ঞাপন</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
