import type { PartListing } from "../types";

// Fair rotation for boosted/sponsored ads.
// - Spotlight slider shows at most MAX_SPOTLIGHT_ADS boosted ads.
// - Main feed shows at most MAX_INLINE_ADS boosted ads, interleaved between
//   normal listings (not grouped at the top).
// - Which ads get picked is random but stable within one page load (seeded),
//   and changes on the next load, so every boosted ad gets its turn.
// - Boosted ads that lose the draw are NOT hidden -- they just appear as
//   normal listings in their usual position.
export const MAX_SPOTLIGHT_ADS = 8;
export const MAX_INLINE_ADS = 6;
export const ADS_INTERLEAVE_GAP = 5;
const FIRST_AD_POSITION = 2;

const SESSION_SEED = Math.floor(Math.random() * 4294967296);

function rankFor(id: string): number {
  // FNV-1a hash of the id, mixed with the per-load seed, then one mulberry32 step.
  let h = 2166136261 ^ SESSION_SEED;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function isLiveAd(item: PartListing): boolean {
  if (!item.isAd) return false;
  if (!item.adExpiresAt) return true;
  return new Date(item.adExpiresAt).getTime() > Date.now();
}

export function pickRotatedAds(ads: PartListing[], max: number): PartListing[] {
  const seen = new Set<string>();
  const live = ads.filter((item) => {
    if (!isLiveAd(item) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return live.sort((a, b) => rankFor(a.id) - rankFor(b.id)).slice(0, max);
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
