import React from "react";
import { PartListing, SupportedLanguage } from "../types";
import { Phone, MapPin, Sparkles, Eye } from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";

interface ListingCardProps {
  key?: string | number;
  listing: PartListing;
  language: SupportedLanguage;
  onViewDetails: (listing: PartListing) => any;
  onPromoteClick: (listing: PartListing) => any;
}

export function ListingCard({ listing, language, onViewDetails, onPromoteClick }: ListingCardProps) {
  const isAd = listing.isAd;
  
  return (
    <div 
      className={`relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition-all duration-300 flex flex-col hover:shadow-md cursor-pointer group ${
        isAd 
          ? "border-2 border-amber-400 hover:border-amber-500 shadow-sm shadow-amber-500/5" 
          : "border border-slate-150 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
      }`}
      onClick={() => onViewDetails(listing)}
    >
      {/* 1. ASPECT-SQUARE IMAGE */}
      <div className="relative aspect-square w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <ImageWithFallback
        src={listing.images && listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Demo badge on image */}
        {(listing.id.startsWith("local-") || listing.id.startsWith("temp-") || listing.id.startsWith("part-") || (listing as any).isDemo === true) && (
          <span className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-[2px] text-amber-400 border border-amber-500/30 font-black text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-md shadow-sm z-10 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            {language === "bn" ? "ডেমো বিজ্ঞাপন" : "DEMO LISTING"}
          </span>
        )}

        {/* Sponsored tag on image */}
        {isAd && (
          <span className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm flex items-center gap-0.5 z-10 animate-pulse">
            <Sparkles className="w-2.5 h-2.5 fill-slate-950 text-slate-950 shrink-0" />
            {language === "bn" ? "বিজ্ঞাপন" : "AD"}
          </span>
        )}

        {/* Subtle Views Indicator overlay */}
        <div className="absolute bottom-2 right-2 bg-black/55 px-1.5 py-0.5 rounded-md backdrop-blur-[1.5px] text-white text-[9px] font-extrabold flex items-center gap-1 z-10">
          <Eye className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{listing.views}</span>
        </div>
      </div>

      {/* 2. PRICE ONLY BLOCK */}
      <div className="p-3 text-center bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-850">
        <span className="text-sm sm:text-base font-black text-orange-600 dark:text-orange-400 font-mono tracking-tight block">
          ৳{listing.price.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
