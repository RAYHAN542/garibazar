import React, { useEffect, useRef } from "react";

// 🔧 (2026-09-30) Replaces the old 320x50 AdsterraBanner unit with
// Adsterra's "Native Banner" format -- a larger, content-styled ad block
// (image + headline + install/CTA button), same visual pattern as the
// Bikroy app's in-feed ads. Native banners work differently from the
// invoke.js banner format: Adsterra's script looks for a container <div>
// with an EXACT id of `container-<key>` already present in the DOM, then
// injects the ad markup into it itself -- so (unlike AdsterraBanner) there's
// no atOptions config object, just the container div + the invoke script.
// Same fresh-injection-per-mount approach as AdsterraBanner since this
// modal mounts/unmounts on every listing open/close.
const NATIVE_BANNER_KEY = "d99072a7314477bf5044a829327ad45b";

export function NativeBannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;
    wrapper.innerHTML = "";

    const adSlot = document.createElement("div");
    adSlot.id = `container-${NATIVE_BANNER_KEY}`;
    wrapper.appendChild(adSlot);

    const invokeScript = document.createElement("script");
    invokeScript.async = true;
    invokeScript.setAttribute("data-cfasync", "false");
    invokeScript.src = `https://pl31579276.profitableratecpmnetwork.com/${NATIVE_BANNER_KEY}/invoke.js`;
    wrapper.appendChild(invokeScript);

    return () => {
      wrapper.innerHTML = "";
    };
  }, []);

  return (
    <div className="w-full flex flex-col items-center bg-slate-900 py-1.5 gap-1">
      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
        বিজ্ঞাপন
      </span>
      <div ref={containerRef} className="w-full min-h-[90px]" />
    </div>
  );
}
