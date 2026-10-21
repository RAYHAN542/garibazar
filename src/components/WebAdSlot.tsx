import { useEffect, useRef, useState } from "react";
import { isNativeAdsSupported } from "../utils/nativeAds";

const CLIENT = "ca-pub-3277203446788826";
const SLOT = (import.meta as any).env?.VITE_ADSENSE_SLOT as string | undefined;

/** শুধু ওয়েবসাইটে AdSense দেখায়। ad না এলে জায়গা গুটিয়ে থাকে, অ্যাপে বা slot না থাকলে কিছুই রেন্ডার করে না। */
export function WebAdSlot() {
  const insRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const [filled, setFilled] = useState(false);
  const enabled = !isNativeAdsSupported() && !!SLOT;

  useEffect(() => {
    if (!enabled || pushed.current) return undefined;
    pushed.current = true;
    try {
      const w = window as any;
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // ignore
    }
    const el = insRef.current;
    if (!el) return undefined;
    const check = () => setFilled(el.getAttribute("data-ad-status") === "filled");
    const mo = new MutationObserver(check);
    mo.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    check();
    return () => mo.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      className="col-span-full overflow-hidden rounded-xl"
      style={filled ? { maxHeight: 300, margin: "8px 0" } : { height: 0 }}
    >
      {filled && <span className="mb-0.5 block text-[10px] text-slate-400">বিজ্ঞাপন</span>}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", maxHeight: 280 }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
