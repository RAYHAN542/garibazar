import { useState, useEffect } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface PromotedSliderProps {
  listings: PartListing[];
  language: SupportedLanguage;
  onViewListing: (listing: PartListing) => void;
}

export function PromotedSlider({ listings, language, onViewListing }: PromotedSliderProps) {
  const promotedListings = listings.filter((item) => item.isAd && (item.adTier === "premium" || item.adTier === "featured"));
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index if out of bounds due to updated listings count
  useEffect(() => {
    if (currentIndex >= promotedListings.length) {
      setCurrentIndex(0);
    }
  }, [promotedListings.length, currentIndex]);

  useEffect(() => {
    if (promotedListings.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotedListings.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [promotedListings.length]);

  if (promotedListings.length === 0) {
    return null;
  }

  const currentItem = promotedListings[currentIndex] || promotedListings[0];

  if (!currentItem) {
    return null;
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % promotedListings.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + promotedListings.length) % promotedListings.length);
  };

  const toBanglaNumber = (num: number): string => {
    const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return num.toLocaleString("en-IN").replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit)]);
  };

  return (
    <div className="mb-2 w-full max-w-xl mx-auto animate-fade-in">
      {/* Title with star icon */}
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        <span className="text-amber-500 text-xs">⭐</span>
        <h3 className="text-[10px] font-black font-sans text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
          {language === "bn" ? "স্পনসরড বিজ্ঞাপন" : "Sponsored Listings"}
        </h3>
      </div>

      {/* Main Slide Card */}
      <div 
        onClick={() => onViewListing(currentItem)}
        className="relative group w-full aspect-[16/9.5] max-h-[195px] sm:max-h-[260px] md:max-h-[300px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-300 cursor-pointer"
      >
        {/* Full-bleed cover image */}
        {currentItem.image ? (
          <img 
            src={currentItem.image} 
            alt={currentItem.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-350 dark:text-slate-700">
            {/* Fallback car SVG/illustration */}
            <svg className="w-16 h-16 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12.5V16c0 .6.4 1 1 1h2m10 0h4" />
              <circle cx="7.5" cy="16.5" r="2.5" />
              <circle cx="15.5" cy="16.5" r="2.5" />
            </svg>
          </div>
        )}

        {/* Top-Left AD Badge */}
        <div className="absolute top-3.5 left-3.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg shadow-md z-10 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 fill-slate-950 text-slate-950 shrink-0 animate-pulse" />
          <span>{language === "bn" ? "বিজ্ঞাপন" : "AD"}</span>
        </div>

        {/* Custom Nav Arrows Center-Aligned (Shows on Hover/Touch) */}
        {promotedListings.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-xs flex items-center justify-center text-white transition-all cursor-pointer opacity-80 group-hover:opacity-100 border border-white/10 z-15"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-xs flex items-center justify-center text-white transition-all cursor-pointer opacity-80 group-hover:opacity-100 border border-white/10 z-15"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Bottom Text Overlay with Gradient */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-12 pb-4 px-4 flex flex-col justify-end text-white select-none">
          <h4 className="font-sans font-bold text-sm sm:text-base md:text-lg text-white leading-tight mb-1 truncate drop-shadow-xs">
            {currentItem.title}
          </h4>
          <div className="flex items-end justify-between">
            <span className="text-base sm:text-lg font-black text-amber-400 font-mono drop-shadow-xs">
              {language === "bn" ? "৳" + toBanglaNumber(currentItem.price) : "৳" + currentItem.price.toLocaleString("en-IN")}
            </span>

            {/* Slide bullet indicators on bottom right */}
            {promotedListings.length > 1 && (
              <div className="flex gap-1.5 pb-1">
                {promotedListings.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                      index === currentIndex ? "w-4 bg-amber-500" : "w-1.5 bg-white/50 hover:bg-white"
                    }`}
                    title={`Slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
