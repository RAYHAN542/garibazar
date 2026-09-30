import type { PartListing } from "../types";
import { apiUrl } from "./apiBase";

// Fair rotation for boosted/sponsored ads -- impression-count based.
// - The top spotlight slider shows at most 6 boosted ads at once.
// - The feed below shows just ONE other-seller boosted post (after the first
//   2 normal posts) -- not a row of them.
// - However many ads exist (100 or 100,000), EVERY ad gets its turn: the
//   database tracks how many times each ad has actually been shown
//   (ad_impressions, bumped via /api/ad-impression -> bump_ad_impressions()
//   RPC), and every homepage load picks whichever LIVE ads have been shown
//   the LEAST so far. This is true fairness -- no reload-guessing, no
//   per-visitor local rotation state, and it works the same for every
//   visitor since the counts live on the server, not in one browser's
//   localStorage.
// - The logged-in seller's OWN live boosted posts are always shown to them
//   first: pinned into their slider window, and placed at the very top of
//   their feed. Other visitors still see them only when their turn comes
//   (by impression count).
// - Boosted ads that aren't picked are NOT hidden -- they just appear as
//   normal listings in their usual position.
export const MAX_SPOTLIGHT_ADS = 6;
export const MAX_INLINE_ADS = 1;
export const ADS_INTERLEAVE_GAP = 5;
const FIRST_AD_POSITION = 2;

const SESSION_STORAGE_KEY = "gari_bazar_session_user";

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

// Fire-and-forget: tells the server these ads were just shown, so their
// impression count goes up and they move to the back of the "least shown"
// queue for the next visitor. Never blocks rendering and never throws --
// this is a best-effort fairness signal, not something the UI depends on.
function reportImpressions(ids: string[]) {
  if (ids.length === 0) return;
  try {
    fetch(apiUrl("/api/ad-impression"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore -- fairness reporting must never break the page
  }
}

// Sorts by ad_impressions ascending (least-shown first); ties broken
// randomly each call so brand-new ads (all at 0) don't always show in the
// same fixed order to every visitor.
function leastShownFirst(items: PartListing[]): PartListing[] {
  return [...items]
    .map((item) => ({ item, jitter: Math.random() }))
    .sort((a, b) => {
      const diff = (a.item.adImpressions ?? 0) - (b.item.adImpressions ?? 0);
      return diff !== 0 ? diff : a.jitter - b.jitter;
    })
    .map(({ item }) => item);
}

export function pickRotatedAds(ads: PartListing[], max: number): PartListing[] {
  const seen = new Set<string>();
  const live = ads.filter((item) => {
    if (!isLiveAd(item) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  if (live.length <= max) {
    reportImpressions(live.map((item) => item.id));
    return live;
  }

  // The viewer's own boosted posts are always shown to them first (and
  // don't count toward -- or need -- the fairness queue, since the viewer
  // chose to look at their own ad).
  const uid = currentUserId();
  const pinned = uid ? live.filter((item) => item.sellerId === uid).slice(0, max) : [];
  const remaining = max - pinned.length;
  if (remaining <= 0) return pinned;

  const pinnedIds = new Set(pinned.map((item) => item.id));
  const rest = live.filter((item) => !pinnedIds.has(item.id));
  const picked = leastShownFirst(rest).slice(0, remaining);
  reportImpressions(picked.map((item) => item.id));
  return [...pinned, ...picked];
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
