import React, { useEffect, useRef } from "react";

interface AdsterraBannerProps {
  adKey: string;
  width: number;
  height: number;
}

// Adsterra ad units work by setting a global `atOptions` object and then
// loading a script keyed off it. Because this modal mounts/unmounts every
// time a listing is opened/closed, the config + invoke script need to be
// freshly (re-)injected into an isolated container each time using real DOM
// nodes (document.createElement + appendChild) -- injected <script> tags
// only execute when appended this way, not via dangerouslySetInnerHTML.
//
// 🔧 (2026-09-27) Adsterra's own "Get Code" snippet for this ad unit
// (320x50_1) actually ships TWO script tags, not one -- the atOptions +
// invoke.js pair below, PLUS a second script hosted on
// profitableratecpmnetwork.com that does the actual ad-serving/creative
// delivery. Only the first pair was ever wired in here, so the slot went
// from fully empty (before the CSP fix let invoke.js itself load) to a
// broken-image icon (invoke.js ran and built the ad container, but the
// second script that fills it with a real creative was simply never
// injected). Both scripts need vercel.json's CSP to allow their domains too.
export function AdsterraBanner({ adKey, width, height }: AdsterraBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const configScript = document.createElement("script");
    configScript.type = "text/javascript";
    configScript.text = `atOptions = { 'key' : '${adKey}', 'format' : 'iframe', 'height' : ${height}, 'width' : ${width}, 'params' : {} };`;

    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.src = `https://www.highrevenueformat.com/${adKey}/invoke.js`;
    invokeScript.async = true;

    // Second script from Adsterra's "Get Code" panel for this exact ad unit
    // -- without this, invoke.js has nothing to actually fill the slot with.
    const creativeScript = document.createElement("script");
    creativeScript.type = "text/javascript";
    creativeScript.src = "https://pl31521943.profitableratecpmnetwork.com/d2/47/2f/d2472fc1d9f7f1c9aba2e0c3492d1a87.js";
    creativeScript.async = true;

    container.appendChild(configScript);
    container.appendChild(invokeScript);
    container.appendChild(creativeScript);

    return () => {
      container.innerHTML = "";
    };
  }, [adKey, width, height]);

  // 🔧 (2026-09-26) আগে এই wrapper-এর background ছিল bg-slate-950, ঠিক
  // modal-এর উপরের ডার্ক হেডারের মতোই -- Adsterra যখন এই স্লটে অ্যাড fill
  // করেনি (নতুন ইউনিট, fill শুরু হতে সময় লাগে), তখন খালি জায়গাটা
  // ব্যাকগ্রাউন্ডের সাথে মিশে গিয়ে সম্পূর্ণ অদৃশ্য হয়ে যাচ্ছিল -- মালিক
  // ভাবছিলেন কোডই কাজ করছে না। এখন হালকা dashed বর্ডার + "বিজ্ঞাপন" লেবেল
  // যুক্ত করা হলো, যাতে খালি অবস্থায়ও স্লটটা আলাদা করে দেখা যায়, আর অ্যাড
  // fill হলে লেবেলটা ছোট আর অপ্রতুল থাকে (অ্যাড নিজেই মূল ফোকাস)।
  return (
    <div className="w-full flex flex-col items-center bg-slate-900 py-1.5 gap-1">
      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
        বিজ্ঞাপন
      </span>
      <div
        ref={containerRef}
        style={{ width, height }}
        className="border border-dashed border-slate-700 flex items-center justify-center"
      />
    </div>
  );
}
