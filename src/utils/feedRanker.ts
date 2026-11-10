import { PartListing } from "../types";

// ---------------------------------------------------------------------------
// 🎯 হোমপেজের "মিশ্র ফিড" (ফেসবুক/ইউটিউবের মতো)।
//
// আগে ফিড শুধু created_at অনুযায়ী নতুন থেকে পুরনো ছিল। এখন:
//  1. কেউ কোনো গাড়ি/ভিডিও খুললে তার ব্র্যান্ড, মডেল, ধরন আর দাম ফোনে (localStorage)
//     জমা হয়। লগইন লাগে না, সার্ভারে কিছু যায় না।
//  2. ফিড তিন ভাগ মিশিয়ে সাজানো হয়: নতুন (৪৮ ঘণ্টার মধ্যে), পছন্দের সাথে মেলে
//     এমন, আর বাকি পুরনো পোস্ট। ঘুরে ঘুরে একটা করে বসে (নতুন, পছন্দের, নতুন,
//     পুরনো, পছন্দের, পুরনো), তাই নতুন পোস্ট কখনো চাপা পড়ে না।
//  3. একই বিক্রেতা বা একই ব্র্যান্ড পরপর ২টার বেশি আসে না।
//  4. পুরনো আগ্রহ ধীরে ধীরে কমে (৭ দিনে অর্ধেক)।
//  5. নতুন ইউজার (কোনো ইতিহাস নেই) আগের মতোই নতুন থেকে পুরনো দেখে।
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gb_interest_v1";
const HALF_LIFE_DAYS = 7;
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;
const LIKED_MIN_SCORE = 1.5;
const MAX_KEYS = 40;
const MAX_MODEL_LEN = 40;

type Pool = "new" | "liked" | "old";
const PATTERN: Pool[] = ["new", "liked", "new", "old", "liked", "old"];

interface Interest {
  t: number;
  b: Record<string, number>; // ব্র্যান্ড
  m: Record<string, number>; // মডেল
  s: Record<string, number>; // সাব-ক্যাটাগরি (car, bike...)
  pSum: number; // দামের ভারযুক্ত যোগফল
  pW: number; // ভারের যোগফল
}

const emptyInterest = (): Interest => ({ t: Date.now(), b: {}, m: {}, s: {}, pSum: 0, pW: 0 });
const norm = (v: unknown): string => (v == null ? "" : String(v)).trim().toLowerCase();

function decayMap(map: Record<string, number> | undefined, f: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!map || typeof map !== "object") return out;
  for (const k of Object.keys(map)) {
    const v = Number(map[k]) * f;
    if (Number.isFinite(v) && v >= 0.05) out[k] = v;
  }
  return out;
}

function trimMap(map: Record<string, number>): Record<string, number> {
  const entries = Object.entries(map);
  if (entries.length <= MAX_KEYS) return map;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_KEYS));
}

export function loadInterest(): Interest {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyInterest();
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return emptyInterest();
    const days = Math.max(0, (Date.now() - (Number(p.t) || Date.now())) / 86400000);
    const f = Math.pow(0.5, days / HALF_LIFE_DAYS);
    return {
      t: Date.now(),
      b: decayMap(p.b, f),
      m: decayMap(p.m, f),
      s: decayMap(p.s, f),
      pSum: (Number(p.pSum) || 0) * f,
      pW: (Number(p.pW) || 0) * f,
    };
  } catch (_) {
    return emptyInterest();
  }
}

/** কেউ একটা লিস্টিং খুললে/ভিডিও দেখলে এটা ডাকা হয়। weight: খোলা=১, (পরে) কল/চ্যাট=৩। */
export function trackInterest(listing: PartListing, weight = 1): void {
  try {
    if (!listing) return;
    const it = loadInterest();
    const brand = norm((listing as any).brand);
    const model = norm((listing as any).model);
    const sub = norm((listing as any).subCategory);
    if (brand) it.b[brand] = (it.b[brand] || 0) + weight;
    if (model && model.length <= MAX_MODEL_LEN) it.m[model] = (it.m[model] || 0) + weight;
    if (sub) it.s[sub] = (it.s[sub] || 0) + weight;
    const price = Number((listing as any).price);
    if (Number.isFinite(price) && price > 0) {
      it.pSum += price * weight;
      it.pW += weight;
    }
    it.b = trimMap(it.b);
    it.m = trimMap(it.m);
    it.s = trimMap(it.s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(it));
  } catch (_) {
    // localStorage বন্ধ/ভর্তি হলে চুপচাপ বাদ -- ফিড আগের মতোই চলবে
  }
}

function scoreItem(item: PartListing, it: Interest): number {
  const b = it.b[norm((item as any).brand)] || 0;
  const m = it.m[norm((item as any).model)] || 0;
  // ব্র্যান্ড বা মডেল না মিললে "পছন্দের" ধরা হয় না (শুধু ধরন/দাম মিললে সব গাড়িই মিলে যেত)
  if (b <= 0 && m <= 0) return 0;
  let s = Math.min(b, 4) * 0.75 + Math.min(m, 3) * 1.5;
  s += Math.min(it.s[norm((item as any).subCategory)] || 0, 6) * 0.2;
  const price = Number((item as any).price);
  if (it.pW > 0 && Number.isFinite(price) && price > 0) {
    const avg = it.pSum / it.pW;
    if (avg > 0) {
      const r = price / avg;
      if (r >= 0.7 && r <= 1.3) s += 1;
    }
  }
  return s;
}

function violates(c: PartListing, last?: PartListing, prev?: PartListing): boolean {
  if (!last || !prev) return false;
  const seller = (c as any).sellerId;
  if (seller && seller === (last as any).sellerId && seller === (prev as any).sellerId) return true;
  const brand = norm((c as any).brand);
  if (brand && brand === norm((last as any).brand) && brand === norm((prev as any).brand)) return true;
  return false;
}

function takeFrom(pool: PartListing[], out: PartListing[]): PartListing {
  const last = out[out.length - 1];
  const prev = out[out.length - 2];
  const limit = Math.min(pool.length, 8);
  for (let i = 0; i < limit; i++) {
    if (!violates(pool[i], last, prev)) return pool.splice(i, 1)[0];
  }
  return pool.shift() as PartListing;
}

/**
 * items: আগে থেকেই নতুন থেকে পুরনো সাজানো (sortOrganic)।
 * পছন্দের ইতিহাস না থাকলে বা মেলে এমন কিছু না পেলে items অপরিবর্তিত ফেরত দেয়।
 */
export function mixFeed(items: PartListing[]): PartListing[] {
  try {
    if (items.length < 4) return items;
    const it = loadInterest();
    if (Object.keys(it.b).length === 0 && Object.keys(it.m).length === 0) return items;

    const now = Date.now();
    const pools: Record<Pool, PartListing[]> = { new: [], liked: [], old: [] };
    const scores = new Map<string, number>();
    for (const item of items) {
      const created = new Date(item.createdAt as any).getTime();
      if (Number.isFinite(created) && now - created <= NEW_WINDOW_MS) {
        pools.new.push(item);
        continue;
      }
      const sc = scoreItem(item, it);
      if (sc >= LIKED_MIN_SCORE) {
        scores.set(item.id, sc);
        pools.liked.push(item);
      } else {
        pools.old.push(item);
      }
    }
    if (pools.liked.length === 0) return items;
    pools.liked.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

    const out: PartListing[] = [];
    let slot = 0;
    while (out.length < items.length) {
      const want = PATTERN[slot % PATTERN.length];
      slot++;
      const order: Pool[] = [want, "new", "liked", "old"];
      const kind = order.find((k) => pools[k].length > 0);
      if (!kind) break;
      out.push(takeFrom(pools[kind], out));
    }
    return out;
  } catch (_) {
    return items;
  }
}
