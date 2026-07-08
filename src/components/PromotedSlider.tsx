import { useState, useEffect } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { ChevronLeft, ChevronRight, MapPin, ArrowRight } from "lucide-react";

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
    <div className="mb-4 w-full max-w-xl mx-auto animate-fade-in">
      {/* Title with rocket icon */}
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <span className="text-sm">🚀</span>
        <h3 className="text-[12px] font-black font-sans text-slate-800 dark:text-slate-100 tracking-tight">
          {language === "bn" ? "বুস্ট বিজ্ঞাপন" : "Boost Ads"}
        </h3>
      </div>

      {/* Main Slide Card */}
      <div
        onClick={() => onViewListing(currentItem)}
        className="relative group w-full aspect-[16/9.5] max-h-[195px] sm:max-h-[260px] md:max-h-[300px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:shadow-lg transition-all duration-300 cursor-pointer"
      >
        {/* Full-bleed cover image */}
        {(currentItem.images?.[0] || currentItem.image) ? (
          <img
            src={currentItem.images?.[0] || currentItem.image}
            alt={currentItem.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700">
            <svg className="w-16 h-16 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12.5V16c0 .6.4 1 1 1h2m10 0h4" />
              <circle cx="7.5" cy="16.5" r="2.5" />
              <circle cx="15.5" cy="16.5" r="2.5" />
            </svg>
          </div>
        )}

        {/* Dark gradient so right-side text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/35 to-black/85" />

        {/* Top-Left Premium/Tier Badge */}
        <div className="absolute top-3.5 left-3.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg shadow-md z-10 flex items-center gap-1">
          <span className="text-[10px] leading-none">★</span>
          <span>
            {currentItem.adTier === "premium"
              ? (language === "bn" ? "প্রিমিয়াম" : "Premium")
              : (language === "bn" ? "ফিচার্ড" : "Featured")}
          </span>
        </div>

        {/* Custom Nav Arrows Center-Aligned */}
        {promotedListings.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur-xs flex items-center justify-center text-white transition-all cursor-pointer border border-white/10 z-15"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/35 hover:bg-black/60 backdrop-blur-xs flex items-center justify-center text-white transition-all cursor-pointer border border-white/10 z-15"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Right-side Text Block: title, location, price, CTA button */}
        <div className="absolute right-4 bottom-4 max-w-[58%] text-right text-white select-none">
          <h4 className="font-sans font-bold text-[13px] sm:text-base leading-tight mb-1 drop-shadow-xs line-clamp-2">
            {currentItem.title}
          </h4>
          {currentItem.location && (
            <div className="flex items-center justify-end gap-1 text-[10px] sm:text-xs text-slate-300 mb-1.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{currentItem.location}</span>
            </div>
          )}
          <div className="text-base sm:text-lg font-black text-amber-400 font-mono drop-shadow-xs mb-2">
            {language === "bn" ? "৳" + toBanglaNumber(currentItem.price) : "৳" + currentItem.price.toLocaleString("en-IN")}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewListing(currentItem);
            }}
            className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-md transition cursor-pointer"
          >
            {language === "bn" ? "বিজ্ঞাপন দেখুন" : "View Ad"}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Slide bullet indicators below the card */}
      {promotedListings.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {promotedListings.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                index === currentIndex ? "w-4 bg-amber-500" : "w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
              }`}
              title={`Slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
