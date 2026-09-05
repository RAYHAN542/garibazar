import React from "react";
import { PartListing, SupportedLanguage } from "../types";
import { MapPin, Sparkles } from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";

interface ListingCardProps {
  key?: string | number;
  listing: PartListing;
  language: SupportedLanguage;
  onViewDetails: (listing: PartListing) => any;
  onPromoteClick: (listing: PartListing) => any;
  isAdmin?: boolean;
  // True only for the first card in a grid -- lets its image skip lazy
  // loading since it's already visible the instant the page paints.
  priority?: boolean;
}

// Raw view counts on public listing cards made the marketplace look empty/dead
// to visitors (e.g. "3 views") even when the site is fine - low numbers read
// as "nobody's here", discouraging both browsing and new sellers from posting.
// Replaced with a tiered "eye" badge (views -> eye is the natural metaphor)
// with small stars sitting along its curved top edge. Every 5 views = 1
// level, capped at 25 (5 tiers x 5 levels each). Star count and badge size
// both grow with tier, color progressing bronze -> diamond like a game rank
// system. Under 5 views (level 0) shows no badge at all, rather than a
// discouraging "0" or empty tier.
const STAR_TIERS = [
  { min: 1, max: 5, bn: "ব্রোঞ্জ", en: "Bronze", c: "#CD7F32", d: "#8A551F", l: "#E3A868" },
  { min: 6, max: 10, bn: "সিলভার", en: "Silver", c: "#C7CCD1", d: "#8C9297", l: "#E7EAED" },
  { min: 11, max: 15, bn: "গোল্ড", en: "Gold", c: "#FFD34D", d: "#C99A00", l: "#FFE58F" },
  { min: 16, max: 20, bn: "প্লাটিনাম", en: "Platinum", c: "#4FC3F7", d: "#0288BB", l: "#8CDBFF" },
  { min: 21, max: 25, bn: "ডায়মন্ড", en: "Diamond", c: "#D48CFF", d: "#9C3FE0", l: "#EFC8FF" },
];

function getStarTier(views: number): { level: number; tierIndex: number; tier: typeof STAR_TIERS[number] } | null {
  const level = Math.min(25, Math.floor((views || 0) / 5));
  if (level < 1) return null;
  let tierIndex = STAR_TIERS.findIndex((t) => level >= t.min && level <= t.max);
  if (tierIndex === -1) tierIndex = STAR_TIERS.length - 1;
  return { level, tierIndex, tier: STAR_TIERS[tierIndex] };
}

// Cubic bezier helper, used to place the little stars exactly along the
// eye's curved top edge (same curve as the outline path below) instead of
// floating in a straight row above it.
function bezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function starPolygonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
    const a2 = a1 + Math.PI / 5;
    pts.push(`${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`);
    pts.push(`${cx + r * 0.42 * Math.cos(a2)},${cy + r * 0.42 * Math.sin(a2)}`);
  }
  return pts.join(" ");
}

function EyeStarBadge({ tier, starCount, size = 34 }: { tier: typeof STAR_TIERS[number]; starCount: number; size?: number }) {
  const starPts: { x: number; y: number }[] = [];
  for (let i = 0; i < starCount; i++) {
    const t = starCount === 1 ? 0.5 : i / (starCount - 1);
    const tt = 0.15 + t * 0.7;
    starPts.push({
      x: bezierPoint(tt, 2, 10, 38, 46),
      y: bezierPoint(tt, 22, 6, 6, 22) - 6.5,
    });
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 42" className="shrink-0" aria-hidden="true">
      <path d="M2 22 C10 6 38 6 46 22 C38 38 10 38 2 22 Z" fill="none" stroke={tier.d} strokeWidth={2.5} />
      <circle cx={24} cy={22} r={10} fill={tier.c} stroke={tier.d} strokeWidth={1.5} />
      <circle cx={24} cy={22} r={5} fill={tier.d} />
      <circle cx={21.7} cy={19.7} r={1.8} fill={tier.l} opacity={0.9} />
      {starPts.map((p, i) => (
        <polygon key={i} points={starPolygonPoints(p.x, p.y, 4.4)} fill={tier.c} />
      ))}
    </svg>
  );
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

function ListingCardImpl({ listing, language, onViewDetails, onPromoteClick, isAdmin, priority = false }: ListingCardProps) {
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
    <a
      href={`/l/${listing.id}`}
      className={`relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 transition-all duration-300 flex flex-col hover:shadow-lg cursor-pointer group border ${
        isAd
          ? "border-2 border-amber-400 shadow-sm shadow-amber-500/10"
          : "border-slate-200 hover:border-amber-300 dark:border-slate-800 dark:hover:border-slate-700"
      }`}
      onClick={(e) => {
        e.preventDefault();
        onViewDetails(listing);
      }}
    >
      {/* IMAGE */}
      <div className="relative aspect-[16/9] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <ImageWithFallback
          src={listing.images && listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          priority={priority}
          width={500}
          height={340}
        />

        <span
          className={`absolute top-1.5 left-1.5 font-black text-[8.5px] uppercase tracking-wide px-1.5 py-0.5 rounded shadow-sm z-10 ${
            isVehicle
              ? "bg-amber-500 text-white"
              : "bg-sky-600 text-white"
          }`}
        >
          {categoryLabel}
        </span>

        {isAd && (
          <span className="absolute top-1.5 right-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5 z-10">
            <Sparkles className="w-2 h-2 fill-white text-white shrink-0" />
            {language === "bn" ? "বিজ্ঞাপন" : "AD"}
          </span>
        )}
      </div>

      {/* DETAILS */}
      <div className="p-1.5 sm:p-2 flex flex-col gap-0.5">
        <h3 className="text-[12px] font-extrabold text-slate-850 dark:text-white leading-snug truncate">
          {listing.title}
        </h3>

        <div className="flex items-center gap-1 text-[9.5px] text-slate-500 dark:text-slate-400 font-semibold truncate">
          <MapPin className="w-2.5 h-2.5 text-amber-500 shrink-0" />
          <span className="truncate">{listing.location}</span>
          {isAdmin && (
            <>
              <span className="mx-1 text-slate-300 dark:text-slate-700">•</span>
              <span className="whitespace-nowrap">{getTimeAgo(listing.createdAt, language)}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[12.5px] font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {listing.price
              ? `৳${listing.price.toLocaleString("en-IN")}`
              : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}
          </span>
          {(() => {
            const result = getStarTier(listing.views || 0);
            if (!result) return <span />;
            return (
              <EyeStarBadge tier={result.tier} starCount={result.tierIndex + 1} size={15 + result.tierIndex * 1.5} />
            );
          })()}
        </div>
      </div>
    </a>
  );
}

export const ListingCard = React.memo(ListingCardImpl);
