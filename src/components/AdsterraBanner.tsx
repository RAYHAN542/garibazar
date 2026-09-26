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

  return (
    <div className="w-full flex justify-center bg-slate-950 py-1.5">
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}
