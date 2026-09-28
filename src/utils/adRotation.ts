import type { PartListing } from "../types";

// Fair rotation for boosted/sponsored ads.
// - The top spotlight slider shows at most 6 boosted ads at once.
// - The feed below shows just ONE other-seller boosted post (after the first
//   2 normal posts) -- not a row of them.
// - However many ads exist, EVERY ad gets its turn: each visitor's browser
//   remembers where it left off and moves forward on every page load,
//   cycling through all ads in a fixed order. New visitors start at a random
//   point so all ads get equal exposure across visitors too.
// - The logged-in seller's OWN live boosted posts are always shown to them
//   first: pinned into their slider window, and placed at the very top of
//   their feed. Other visitors still see them only when their turn comes.
// - Boosted ads that aren't picked are NOT hidden -- they just appear as
//   normal listings in their usual position.
export const MAX_SPOTLIGHT_ADS = 6;
export const MAX_INLINE_ADS = 1;
export const ADS_INTERLEAVE_GAP = 5;
const FIRST_AD_POSITION = 2;

const SESSION_STORAGE_KEY = "gari_bazar_session_user";
const SLIDER_OFFSET_KEY = "gari_bazar_ad_rotation_offset";
const FEED_OFFSET_KEY = "gari_bazar_ad_feed_rotation_offset";

// Read this visitor's position in a rotation once per page load, then
// advance it for the next load.
function readAndAdvance(storageKey: string, step: number): number {
  let offset = Math.floor(Math.random() * 1_000_000);
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) offset = parsed;
    }
    localStorage.setItem(storageKey, String(offset + step));
  } catch {
    // storage unavailable: fall back to a random start for this load
  }
  return offset;
}

// Slider moves forward by a whole window (6) per load; the single feed ad
// moves forward by 1 per load so it also visits every ad.
const SLIDER_OFFSET = readAndAdvance(SLIDER_OFFSET_KEY, MAX_SPOTLIGHT_ADS);
const FEED_OFFSET = readAndAdvance(FEED_OFFSET_KEY, MAX_INLINE_ADS);

function currentUserId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const uid = JSON.parse(raw)?.uid;
    return typeof uid === "string" && uid ? uid : null;
  } catch {
    return null;
  }
}

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

  // The viewer's own boosted posts are always shown to them first.
  const uid = currentUserId();
  const pinned = uid ? live.filter((item) => item.sellerId === uid).slice(0, max) : [];
  const remaining = max - pinned.length;
  if (remaining <= 0) return pinned;

  const pinnedIds = new Set(pinned.map((item) => item.id));
  const rest = live.filter((item) => !pinnedIds.has(item.id));
  const offset = max === MAX_INLINE_ADS ? FEED_OFFSET : SLIDER_OFFSET;
  const start = offset % rest.length;
  const window = Array.from({ length: Math.min(remaining, rest.length) }, (_, i) => rest[(start + i) % rest.length]);
  return [...pinned, ...window];
}

export function interleaveAds(items: PartListing[]): PartListing[] {
  // The viewer's own live boosted posts go to the very top of THEIR feed.
  const uid = currentUserId();
  const mine = uid ? items.filter((item) => isLiveAd(item) && item.sellerId === uid) : [];
  const mineIds = new Set(mine.map((item) => item.id));
  const others = mineIds.size > 0 ? items.filter((item) => !mineIds.has(item.id)) : items;

  const picked = pickRotatedAds(others, MAX_INLINE_ADS);
  if (picked.length === 0) return [...mine, ...others];

  const pickedIds = new Set(picked.map((p) => p.id));
  const organic = others.filter((item) => !pickedIds.has(item.id));
  if (organic.length === 0) return [...mine, ...picked];

  const out: PartListing[] = [...mine];
  let next = 0;
  organic.forEach((item, idx) => {
    out.push(item);
    const n = idx + 1;
    const isSlot =
      n === FIRST_AD_POSITION ||
      (n > FIRST_AD_POSITION && (n - FIRST_AD_POSITION) % ADS_INTERLEAVE_GAP === 0);
    if (isSlot && next < picked.length) out.push(picked[next++]);
  });
  // Very short feed: still show the boosted ad.
  if (next === 0) out.push(picked[next++]);
  return out;
}
export { shuffleArray } from "./shuffle";
