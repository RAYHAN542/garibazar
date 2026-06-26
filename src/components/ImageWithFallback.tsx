import React, { useState } from "react";
import { Image, ShieldAlert } from "lucide-react";

interface ImageWithFallbackProps {
  id?: string;
  src: string;
  alt: string;
  className?: string;
  isAd?: boolean;
}

export function ImageWithFallback({ id, src, alt, className = "", isAd = false }: ImageWithFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        id={id ? `img-fallback-err-${id}` : undefined}
        className={`w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-3 text-center ${className}`}
      >
        <ShieldAlert className="w-8 h-8 text-amber-500/80 mb-1.5" />
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          ছবি নেই
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      {loading && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <Image className="w-6 h-6 text-slate-400/60" />
        </div>
      )}
      <img
        id={id}
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loading ? "opacity-0 absolute inset-0" : "opacity-100"} ${className}`}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
