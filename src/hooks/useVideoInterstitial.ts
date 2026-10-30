import { useEffect, useRef, useState } from "react";
import { preloadInterstitial, showInterstitial } from "../utils/interstitialAds";

// প্রতি এতগুলো ভিডিও swipe করার পর একটা ad
const AD_EVERY = 4;
// দুই ad-এর মাঝে সর্বনিম্ন বিরতি
const MIN_GAP_MS = 30_000;

/**
 * ভিডিও ফিডে swipe গুনে Interstitial ad দেখায়।
 * ad চলার সময় true ফেরত দেয়, যাতে ভিডিও pause থাকে।
 */
export function useVideoInterstitial(activeIndex: number, enabled: boolean): boolean {
  const [adPlaying, setAdPlaying] = useState(false);
  const prevIndex = useRef(activeIndex);
  const advances = useRef(0);
  const busy = useRef(false);
  const lastShown = useRef(0);

  useEffect(() => {
    if (enabled) void preloadInterstitial();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (prevIndex.current === activeIndex) return;
    prevIndex.current = activeIndex;
    advances.current += 1;
    if (advances.current < AD_EVERY || busy.current) return;
    if (Date.now() - lastShown.current < MIN_GAP_MS) return;

    busy.current = true;
    setAdPlaying(true);
    (async () => {
      const shown = await showInterstitial();
      if (shown) {
        advances.current = 0;
        lastShown.current = Date.now();
      }
      busy.current = false;
      setAdPlaying(false);
      void preloadInterstitial();
    })();
  }, [activeIndex, enabled]);

  return adPlaying;
}
