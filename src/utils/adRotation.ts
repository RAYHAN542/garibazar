import type { PartListing } from "../types";
import { apiUrl } from "./apiBase";

// Fair rotation for boosted/sponsored ads.
// - The top spotlight slider shows at most MAX_SPOTLIGHT_ADS boosted ads.
// - The feed below shows up to MAX_INLINE_ADS boosted posts, placed at fixed
//   serial positions in the grid (2nd item, then every ADS_INTERLEAVE_GAP
//   items after that) -- someone paying to boost a post wants it actually
//   seen, so the feed carries the same allowance as the slider.
// - Server-side impression counting: every time interleaveAds/pickRotatedAds
//   actually places an ad in front of a visitor, it fires a best-effort,
//   non-blocking call to /api/ad-impression, which bumps that listing's
//   ad_impressions column via the bump_ad_impressions() RPC. This lets a
//   caller that DOES select ads by least-shown-first (pickRotatedAds) give
//   true fairness across however many ads are boosted at once (100 or
//   100,000), without relying on client-side reload-guessing.
export const MAX_SPOTLIGHT_ADS = 6;
export const MAX_INLINE_ADS = 6;
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

// Picks up to `max` LIVE boosted ads out of `ads`, preferring whichever have
// been shown the least (server-tracked ad_impressions), and reports the
// impression for whatever it picks. The logged-in viewer's own boosted posts
// are always included first (pinned) so a seller can always see their own
// live ad regardless of the fairness queue.
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

// Interleaves a pre-selected list of ad items into a list of organic items,
// at fixed serial positions: the FIRST_AD_POSITION-th organic item, then
// every `gap` organic items after that. Any ad items left over once the
// organic list runs out are appended at the end (so nothing is silently
// dropped). Reports impressions for whichever ads actually get placed.
export function interleaveAds(
  organicItems: PartListing[],
  adItems: PartListing[],
  gap: number = ADS_INTERLEAVE_GAP
): PartListing[] {
  if (adItems.length === 0) return organicItems;
  reportImpressions(adItems.filter(isLiveAd).map((item) => item.id));

  const out: PartListing[] = [];
  let next = 0;
  organicItems.forEach((item, idx) => {
    out.push(item);
    const n = idx + 1;
    const isSlot = n === FIRST_AD_POSITION || (n > FIRST_AD_POSITION && (n - FIRST_AD_POSITION) % gap === 0);
    if (isSlot && next < adItems.length) out.push(adItems[next++]);
  });
  while (next < adItems.length) {
    out.push(adItems[next++]);
  }
  return out;
}

export { shuffleArray } from "./shuffle";
