// 🔎 "আমি খুঁজছি" সেভ করা সার্চ: ফোনে (localStorage) জমা থাকে, সর্বোচ্চ ৫টা।
// নতুন পোস্ট এই শর্তে মিললে সার্ভার পুশ অ্যালার্ট পাঠায় (matching_devices ফাংশন, interests.ss)।
// সার্ভারে যায় শুধু ব্র্যান্ড/শব্দ/দাম/বছর -- কোনো নাম বা নম্বর নয়।

export interface SavedSearch {
  id: string;
  b: string; // ব্র্যান্ড (ছোট হাতের), ফাঁকা = যেকোনো
  k: string; // মডেল/শব্দ (ছোট হাতের), ফাঁকা = যেকোনো
  p: number; // সর্বোচ্চ দাম (টাকা), ০ = সীমা নেই
  y1: number; // বছর থেকে, ০ = সীমা নেই
  y2: number; // বছর পর্যন্ত, ০ = সীমা নেই
}

const KEY = "gb_saved_searches_v1";
export const MAX_SAVED_SEARCHES = 5;

const cleanText = (v: unknown): string =>
  String(v == null ? "" : v)
    .toLowerCase()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);

const cleanNum = (v: unknown, min: number, max: number): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) return 0;
  return n;
};

export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const out: SavedSearch[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const b = cleanText((r as any).b);
      const k = cleanText((r as any).k);
      if (!b && !k) continue;
      out.push({
        id: String((r as any).id || Math.random().toString(36).slice(2)),
        b,
        k,
        p: cleanNum((r as any).p, 1, 999999999),
        y1: cleanNum((r as any).y1, 1980, 2039),
        y2: cleanNum((r as any).y2, 1980, 2039),
      });
    }
    return out.slice(0, MAX_SAVED_SEARCHES);
  } catch (_) {
    return [];
  }
}

function persist(list: SavedSearch[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED_SEARCHES))); } catch (_) {}
  try {
    window.dispatchEvent(new Event("gb:saved-searches"));
    // devicePush.ts এটা শুনে ২০ সেকেন্ড পরে সার্ভারে পাঠায়
    window.dispatchEvent(new Event("gb:interest-changed"));
  } catch (_) {}
}

/** সফল হলে "ok"; ব্র্যান্ড/শব্দ কিছুই না দিলে "empty"; ৫টা পূর্ণ হলে "full" */
export function addSavedSearch(input: { b?: string; k?: string; p?: number | string; y1?: number | string; y2?: number | string }): "ok" | "empty" | "full" {
  const b = cleanText(input.b);
  const k = cleanText(input.k);
  if (!b && !k) return "empty";
  const list = loadSavedSearches();
  if (list.length >= MAX_SAVED_SEARCHES) return "full";
  let y1 = cleanNum(input.y1, 1980, 2039);
  let y2 = cleanNum(input.y2, 1980, 2039);
  if (y1 && y2 && y1 > y2) { const t = y1; y1 = y2; y2 = t; }
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    b,
    k,
    p: cleanNum(input.p, 1, 999999999),
    y1,
    y2,
  });
  persist(list);
  return "ok";
}

export function removeSavedSearch(id: string): void {
  persist(loadSavedSearches().filter((s) => s.id !== id));
}

/** সার্ভারে পাঠানোর ছোট রূপ (শূন্য/ফাঁকা বাদ) */
export function savedSearchesPayload(): Array<Record<string, string | number>> {
  return loadSavedSearches().map((s) => {
    const o: Record<string, string | number> = {};
    if (s.b) o.b = s.b;
    if (s.k) o.k = s.k;
    if (s.p) o.p = s.p;
    if (s.y1) o.y1 = s.y1;
    if (s.y2) o.y2 = s.y2;
    return o;
  });
}

export function describeSavedSearch(s: SavedSearch, bn: boolean): string {
  const parts: string[] = [];
  const cap = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());
  if (s.b) parts.push(cap(s.b));
  if (s.k) parts.push(cap(s.k));
  if (s.y1 || s.y2) parts.push((s.y1 || "…") + "–" + (s.y2 || "…"));
  if (s.p) parts.push((bn ? "৳" : "≤ ৳") + s.p.toLocaleString("en-IN") + (bn ? " পর্যন্ত" : ""));
  return parts.join(" • ");
}

// 💾 "ড্যাশবোর্ডে সংরক্ষণ" চাপলে ওই মডেল "আমি খুঁজছি"-তে নিজে ঢোকে: এরপর ওই মডেলের নতুন পোস্টে নোটিফিকেশন (দাম যা-ই হোক)।
// ৫টা ভরা থাকলে সবচেয়ে পুরনোটা সরে যায়, যাতে সবচেয়ে নতুন সংরক্ষণটাই কাজ করে।
const MODEL_STOP = new Set(["toyota","honda","nissan","suzuki","mitsubishi","mazda","subaru","yamaha","bajaj","tvs","hero","used","new","car","cars","japan","sale","fresh","recondition","reconditioned","full","super","good","price","auction","grade","for","the","and","with","bangladesh","dhaka"]);

export function modelKeywordOf(l: { brand?: string; model?: string; title?: string }): string {
  const text = ((l.model || "") + " " + (l.title || "")).toLowerCase();
  const brand = (l.brand || "").toLowerCase().trim();
  const toks = text.match(/[a-z][a-z0-9-]{2,}/g) || [];
  for (const t of toks) {
    if (t === brand || MODEL_STOP.has(t)) continue;
    return t;
  }
  return "";
}

export function addModelSearchFromListing(l: { brand?: string; model?: string; title?: string }): void {
  const b = cleanText(l.brand);
  const k = cleanText(modelKeywordOf(l));
  if (!k) return; // মডেলের নাম ধরা না গেলে শুধু ব্র্যান্ড দিয়ে সবার অ্যালার্ট দেওয়া হবে না
  const list = loadSavedSearches();
  if (list.some((s) => s.b === b && s.k === k && !s.p && !s.y1 && !s.y2)) return;
  if (list.length >= MAX_SAVED_SEARCHES) list.shift();
  list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), b, k, p: 0, y1: 0, y2: 0 });
  persist(list);
}
