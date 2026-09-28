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
// 🔧 (2026-09-29) Removed a third <script> that used to be injected here
// (pl31521943.profitableratecpmnetwork.com/...js). That is the Adsterra
// *Social Bar* script, which index.html already loads globally -- loading
// it again on every listing open was a duplicate, not part of the 320x50
// banner unit. The real cause of the empty/broken banner was vercel.json's
// CSP blocking Adsterra's rotating ad + tracking domains (fixed by allowing
// https: for script/connect/frame).
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

    container.appendChild(configScript);
    container.appendChild(invokeScript);

    return () => {
      container.innerHTML = "";
    };
  }, [adKey, width, height]);

  // 🔧 (2026-09-26) আগে এই wrapper-এর background ছিল bg-slate-950, ঠিক modal-এর উপরের ডার্ক হেডারের
  // মতোই -- Adsterra যখন এই স্লটে অ্যাড fill করেনি, খালি জায়গাটা ব্যাকগ্রাউন্ডের
  // সাথে মিশে অদৃশ্য হয়ে যাচ্ছিল। এখন হালকা dashed বর্ডার + "বিজ্ঞাপন" লেবেল
  // যুক্ত করা হলো, যাতে খালি অবস্থায়ও স্লটটা আলাদা করে দেখা যায়।
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
