import type { PartListing } from "../types";

// Fair rotation for boosted/sponsored ads.
// - The homepage never shows more than 6 boosted ads at once (spotlight
//   slider and feed both use the same 6-ad window).
// - However many ads exist, EVERY ad gets its turn: each visitor's browser
//   remembers where it left off and moves the window forward by 6 on every
//   page load, cycling through all ads in a fixed order. New visitors start
//   at a random point so all ads get equal exposure across visitors too.
// - Boosted ads outside the current window are NOT hidden -- they just
//   appear as normal listings in their usual position.
export const MAX_SPOTLIGHT_ADS = 6;
export const MAX_INLINE_ADS = 6;
export const ADS_INTERLEAVE_GAP = 5;
const FIRST_AD_POSITION = 2;

const OFFSET_STORAGE_KEY = "gari_bazar_ad_rotation_offset";

// Read this visitor's position in the rotation once per page load, then
// advance it for the next load.
function readAndAdvanceOffset(): number {
  let offset = Math.floor(Math.random() * 1_000_000);
  try {
    const saved = localStorage.getItem(OFFSET_STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) offset = parsed;
    }
    localStorage.setItem(OFFSET_STORAGE_KEY, String(offset + MAX_INLINE_ADS));
  } catch {
    // storage unavailable: fall back to a random start for this load
  }
  return offset;
}

const PAGE_OFFSET = readAndAdvanceOffset();

function isLiveAd(item: PartListing): boolean {
  if (!item.isAd) return false;
  if (!item.adExpiresAt) return true;
  return new Date(item.adExpiresAt).getTime() > Date.now();
}

export function pickRotatedAds(ads: PartListing[], max: number): PartListing[] {
  const seen = new Set<string>();
  const live = ads
    .filter((item) => {
      if (!isLiveAd(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    // fixed order so the rotating window walks through every ad
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (live.length <= max) return live;

  const start = PAGE_OFFSET % live.length;
  return Array.from({ length: max }, (_, i) => live[(start + i) % live.length]);
}

export function interleaveAds(items: PartListing[]): PartListing[] {
  const picked = pickRotatedAds(items, MAX_INLINE_ADS);
  if (picked.length === 0) return items;

  const pickedIds = new Set(picked.map((p) => p.id));
  const organic = items.filter((item) => !pickedIds.has(item.id));
  if (organic.length === 0) return picked;

  const out: PartListing[] = [];
  let next = 0;
  organic.forEach((item, idx) => {
    out.push(item);
    const n = idx + 1;
    const isSlot =
      n === FIRST_AD_POSITION ||
      (n > FIRST_AD_POSITION && (n - FIRST_AD_POSITION) % ADS_INTERLEAVE_GAP === 0);
    if (isSlot && next < picked.length) out.push(picked[next++]);
  });
  // Very short feed: still show one boosted ad.
  if (next === 0) out.push(picked[next++]);
  return out;
}
export { shuffleArray } from "./shuffle";
