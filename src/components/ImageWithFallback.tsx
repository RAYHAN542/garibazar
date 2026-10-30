import React, { useEffect, useState } from "react";
import { ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { getOptimizedImageUrl } from "../utils/cloudinary";
import { isImgbbUrl, isImgbbPlaceholderSize, getCloudinaryFetchUrl } from "../utils/imgbb";

interface ImageWithFallbackProps {
  id?: string;
  src: string;
  alt: string;
  className?: string;
  isAd?: boolean;
  width?: number;
  height?: number;
  // Set true only for the very first, above-the-fold image on a page (e.g.
  // the first listing card in the grid). The browser can start downloading
  // it immediately instead of waiting to discover it lazily, and treats it
  // as higher priority than the rest of the (lazy) images below the fold.
  priority?: boolean;
}

// If an image has not finished loading after this long, give up on it.
const LOAD_TIMEOUT_MS = 12000;

const withCacheBust = (url: string, nonce: number): string =>
  nonce ? `${url}${url.includes("?") ? "&" : "?"}r=${nonce}` : url;

export function ImageWithFallback({ id, src, alt, className = "", isAd = false, width = 500, height, priority = false }: ImageWithFallbackProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // "primary" = the normal URL; "cloudinary" = second attempt for ibb.co
  // URLs, routed through Cloudinary fetch delivery.
  const [stage, setStage] = useState<"primary" | "cloudinary">("primary");
  const [retryNonce, setRetryNonce] = useState(0);

  // A reused component instance (list recycling) must start fresh for a new src.
  useEffect(() => {
    setLoading(true);
    setError(false);
    setStage("primary");
    setRetryNonce(0);
  }, [src]);

  const onFail = () => {
    if (stage === "primary" && isImgbbUrl(src)) {
      setStage("cloudinary");
      setLoading(true);
      return;
    }
    setLoading(false);
    setError(true);
  };

  // Timeout: covers images that hang forever (onError never fires).
  useEffect(() => {
    if (!loading || error || !src) return;
    const t = window.setTimeout(onFail, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, src, stage, retryNonce]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // imgbb's outage placeholder loads fine (HTTP 200) -- catch it by size.
    if (isImgbbUrl(src) && isImgbbPlaceholderSize(img.naturalWidth, img.naturalHeight)) {
      onFail();
      return;
    }
    setLoading(false);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(false);
    setLoading(true);
    setStage("primary");
    setRetryNonce(Date.now());
  };

  if (error || !src) {
    return (
      <div className={`w-full h-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-3 ${className}`}>
        <ShieldAlert className="w-8 h-8 text-amber-500/80 mb-1.5" />
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">ছবি নেই</span>
        {src && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  const baseUrl =
    stage === "cloudinary"
      ? getCloudinaryFetchUrl(src, Math.max(width, 1000))
      : getOptimizedImageUrl(src, width);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900">
      {loading && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-400/60 animate-spin" />
        </div>
      )}
      <img
        key={`${stage}-${retryNonce}`}
        id={id}
        src={withCacheBust(baseUrl, retryNonce)}
        width={width}
        height={height}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loading ? "opacity-0 absolute inset-0" : "opacity-100"} ${className}`}
        onLoad={handleLoad}
        onError={onFail}
        loading={priority ? "eager" : "lazy"}
        // @ts-ignore -- fetchpriority is a valid HTML attribute but not yet
        // in React's TS types for <img>; safe to pass through as a DOM attr.
        fetchpriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </div>
  );
}
