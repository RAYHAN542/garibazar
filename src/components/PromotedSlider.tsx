import { useState, useEffect, useRef } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { MapPin, ArrowRight, Plus } from "lucide-react";

interface PromotedSliderProps {
  listings: PartListing[];
  language: SupportedLanguage;
  onViewListing: (listing: PartListing) => void;
  onOpenLottery: () => void;
  onGoToAdsPage: () => void;
}

export function PromotedSlider({ listings, language, onViewListing, onOpenLottery, onGoToAdsPage }: PromotedSliderProps) {
  const promotedListings = listings.filter((item) => item.isAd && (item.adTier === "basic" || item.adTier === "premium" || item.adTier === "featured"));
  const [currentIndex, setCurrentIndex] = useState(0);
  // 🎯 "Free Ads" পিলে ট্যাপ করলে এই ছোট্ট মেনু খুলবে, যেখানে দুইটা অপশন থাকবে:
  // ফ্রি লটারি বিজ্ঞাপন আর বিজ্ঞাপন কেনা (আগের "Boost Ads" পিল এখন এখানে চলে এসেছে)
  const [showAdsMenu, setShowAdsMenu] = useState(false);

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
    }, 3000);
    return () => clearInterval(interval);
  }, [promotedListings.length]);

  // 👉 হাত দিয়ে সোয়াইপ করার জন্য টাচ ট্র্যাকিং
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const didSwipe = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    didSwipe.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    const SWIPE_THRESHOLD = 40; // px
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD && promotedListings.length > 1) {
      didSwipe.current = true;
      setShowAdsMenu(false);
      if (touchDeltaX.current < 0) {
        // বামে সোয়াইপ → পরের স্লাইড
        setCurrentIndex((prev) => (prev + 1) % promotedListings.length);
      } else {
        // ডানে সোয়াইপ → আগের স্লাইড
        setCurrentIndex((prev) => (prev - 1 + promotedListings.length) % promotedListings.length);
      }
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  const handleCardClick = () => {
    // সোয়াইপ করার পর accidentally listing না খুলে যাওয়ার জন্য
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    // মেনু খোলা থাকলে প্রথম ট্যাপে শুধু মেনু বন্ধ হবে, লিস্টিং খুলবে না
    if (showAdsMenu) {
      setShowAdsMenu(false);
      return;
    }
    onViewListing(currentItem);
  };

  const currentItem = promotedListings[currentIndex] || promotedListings[0];

  const toBanglaNumber = (num: number): string => {
    const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return num.toLocaleString("en-IN").replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit)]);
  };

  return (
    <div className="mb-2.5 w-full max-w-xl mx-auto animate-fade-in">
      {currentItem && (
      <>
      {/* Main Slide Card — swipeable */}
      <div
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative group w-full aspect-[13/6] max-h-[195px] sm:max-h-[260px] md:max-h-[300px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:shadow-lg transition-all duration-300 cursor-pointer touch-pan-y"
      >
        {/* Full-bleed cover image */}
        {(currentItem.images?.[0] || currentItem.image) ? (
          <img
            src={currentItem.images?.[0] || currentItem.image}
            alt={currentItem.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            referrerPolicy="no-referrer"
            draggable={false}
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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent from-40% via-black/25 via-70% to-black/80" />

        {/* Top-Right "Free Ads" pill — ট্যাপ করলে একটা ছোট মেনু খুলবে:
            "Free Lottery Ads" (ফ্রী লটারি) আর "Buy Ads" (আগের "Boost Ads",
            এখন এই মেনুর ভেতরে চলে এসেছে) */}
        <div className="absolute top-2 right-3.5 z-20">
          <button
            id="open-lottery-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAdsMenu((prev) => !prev);
            }}
            title={language === "bn" ? "বিজ্ঞাপন অপশন দেখুন" : "See ad options"}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-[10px] sm:text-xs pl-3 pr-1.5 py-1 rounded-full shadow-md transition cursor-pointer active:scale-95"
          >
            <span className="whitespace-nowrap">
              {language === "bn" ? "ফ্রি বিজ্ঞাপন" : "Free Ads"}
            </span>
            <ArrowRight className={`w-3 h-3 shrink-0 transition-transform duration-200 ${showAdsMenu ? "rotate-90" : ""}`} />
            <span className="w-5 h-5 rounded-full bg-slate-950/15 flex items-center justify-center shrink-0">
              <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdsMenu ? "rotate-45" : ""}`} strokeWidth={3} />
            </span>
          </button>

          {showAdsMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full right-0 mt-1.5 flex flex-col gap-1.5 min-w-[172px] bg-slate-950/95 border border-slate-800 rounded-2xl p-1.5 shadow-xl animate-fade-in"
            >
              {/* অপশন ১: ফ্রি লটারি বিজ্ঞাপন */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdsMenu(false);
                  onOpenLottery();
                }}
                title={language === "bn" ? "ফ্রী বুস্ট লটারি" : "Free Boost Lottery"}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm transition cursor-pointer active:scale-95"
              >
                <span className="text-[10px] leading-none">🎁</span>
                <span className="whitespace-nowrap">
                  {language === "bn" ? "ফ্রি লটারি বিজ্ঞাপন" : "Free Lottery Ads"}
                </span>
              </button>

              {/* অপশন ২: বিজ্ঞাপন কিনুন (আগের "Boost Ads") */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdsMenu(false);
                  onGoToAdsPage();
                }}
                title={language === "bn" ? "বিজ্ঞাপন কিনুন" : "Buy an ad"}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-sm transition cursor-pointer active:scale-95"
              >
                <span className="text-[10px] leading-none">★</span>
                <span className="whitespace-nowrap">
                  {language === "bn" ? "বিজ্ঞাপন কিনুন" : "Buy Ads"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right-side Text Block: title, location, price — whole card is
            already clickable (handleCardClick), so no separate "View Ad"
            button is needed here; it only ate vertical space and pushed
            this block up into the Free Ads pill above. */}
        <div className="absolute right-4 bottom-4 max-w-[58%] text-right text-white select-none z-10">
          <h4 className="font-sans font-bold text-[13px] sm:text-base leading-tight mb-1 drop-shadow-xs line-clamp-2">
            {currentItem.title}
          </h4>
          {currentItem.location && (
            <div className="flex items-center justify-end gap-1 text-[10px] sm:text-xs text-slate-300 mb-1.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{currentItem.location}</span>
            </div>
          )}
          <div className="text-base sm:text-lg font-black text-amber-400 font-mono drop-shadow-xs">
            {language === "bn" ? "৳" + toBanglaNumber(currentItem.price) : "৳" + currentItem.price.toLocaleString("en-IN")}
          </div>
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
      </>
      )}
    </div>
  );
}
