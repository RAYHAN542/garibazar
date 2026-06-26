import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Image, ShieldAlert, Sparkles } from "lucide-react";

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

  // Fallback visual render if image fails to load or empty
  if (error || !src) {
    return (
      <div 
        id={id ? `img-fallback-err-${id}` : undefined}
        className={`w-full h-full bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-3 text-center ${className}`}
      >
        <ShieldAlert className="w-8 h-8 text-amber-500/80 mb-1.5 animate-bounce" />
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
          Image Missing
        </span>
        <span className="text-[7.5px] text-slate-400 mt-1">
          Secure Sandbox Load Safe
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* 1. SKELETON SHIMMER */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center"
          >
            <div className="relative w-full h-full animate-pulse flex items-center justify-center bg-gradient-to-r from-transparent via-white/10 to-transparent">
              <Image className="w-6 h-6 text-slate-400/80 shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. REAL IMAGE RESILIENT */}
      <motion.img
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ 
          opacity: loading ? 0 : 1, 
          scale: loading ? 1.02 : 1 
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        src={src}
        alt={alt}
        className={`${className} ${loading ? "absolute inset-0 w-full h-full" : ""}`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
