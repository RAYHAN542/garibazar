import React from "react";
import { PartListing, SupportedLanguage } from "../types";
import { MapPin, Sparkles, Eye } from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";

interface ListingCardProps {
  key?: string | number;
  listing: PartListing;
  language: SupportedLanguage;
  onViewDetails: (listing: PartListing) => any;
  onPromoteClick: (listing: PartListing) => any;
}

function getTimeAgo(createdAt: any, language: SupportedLanguage): string {
  try {
    let then: number;
    if (createdAt && typeof createdAt === "object" && typeof createdAt.seconds === "number") {
      then = createdAt.seconds * 1000;
    } else {
      then = new Date(createdAt).getTime();
    }
    if (isNaN(then)) return "";
    const now = Date.now();
    const diffMs = Math.max(0, now - then);
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (language === "bn") {
      if (minutes < 60) return `${Math.max(1, minutes)} মিনিট আগে`;
      if (hours < 24) return `${hours} ঘন্টা আগে`;
      return `${days} দিন আগে`;
    } else {
      if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    }
  } catch (e) {
    return "";
  }
}

export function ListingCard({ listing, language, onViewDetails, onPromoteClick }: ListingCardProps) {
  const isAd = listing.isAd;
  const isVehicle = (listing as any).type === "vehicle"
    ? true
    : (listing as any).type === "part"
    ? false
    : listing.category === "vehicles";
  const categoryLabel = isVehicle
    ? (language === "bn" ? "গাড়ি" : "Vehicle")
    : (language === "bn" ? "পার্ট" : "Part");

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition-all duration-300 flex flex-col hover:shadow-lg cursor-pointer group border ${
        isAd
          ? "border-2 border-amber-400 shadow-sm shadow-amber-500/10"
          : "border-slate-200 hover:border-amber-300 dark:border-slate-800 dark:hover:border-slate-700"
      }`}
      onClick={() => onViewDetails(listing)}
    >
      {/* IMAGE */}
      <div className="relative aspect-[4/3] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <ImageWithFallback
          src={listing.images && listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span
          className={`absolute top-2 left-2 font-black text-[9.5px] uppercase tracking-wide px-2 py-1 rounded-md shadow-sm z-10 ${
            isVehicle
              ? "bg-amber-500 text-white"
              : "bg-sky-600 text-white"
          }`}
        >
          {categoryLabel}
        </span>

        {isAd && (
          <span className="absolute top-2 right-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-md shadow-sm flex items-center gap-0.5 z-10">
            <Sparkles className="w-2.5 h-2.5 fill-white text-white shrink-0" />
            {language === "bn" ? "বিজ্ঞাপন" : "AD"}
          </span>
        )}
      </div>

      {/* DETAILS */}
      <div className="p-2.5 flex flex-col gap-1">
        <h3 className="text-[13px] font-extrabold text-slate-850 dark:text-white leading-snug truncate">
          {listing.title}
        </h3>

        <div className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold truncate">
          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="truncate">{listing.location}</span>
          <span className="mx-1 text-slate-300 dark:text-slate-700">•</span>
          <span className="whitespace-nowrap">{getTimeAgo(listing.createdAt, language)}</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-black text-amber-600 dark:text-amber-400 tracking-tight">
            ৳{listing.price.toLocaleString("en-IN")}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
            <Eye className="w-3.5 h-3.5" />
            {listing.views || 0}
          </span>
        </div>
      </div>
    </div>
  );
}
