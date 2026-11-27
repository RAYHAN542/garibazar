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

// 🔎 সার্চে মডেলের নাম থাকলে (যেমন "axio") সর্বশেষ সার্চ করা মডেলটা ফোনে জমা থাকে, সার্ভারে সেভ-সার্চের খালি ঘরে যায়।
// ব্যবহারকারীর নিজের "আমি খুঁজছি" তালিকা বদলায় না। প্রতিটা সারির প্রথম নাম ইংরেজি, বাকিগুলো বাংলা বানান।
const SEARCH_MODELS: string[][] = [
  ["corolla", "করোলা", "করোল্লা", "কোরোল্লা"],
  ["axio", "এক্সিও", "আক্সিও"],
  ["premio", "প্রিমিও"],
  ["allion", "এলিয়ন", "অ্যালিয়ন"],
  ["noah", "নোহা", "নোয়াহ"],
  ["voxy", "ভক্সি", "ভক্সী"],
  ["hiace", "হায়েস", "হায়েক্স"],
  ["probox", "প্রোবক্স"],
  ["fielder", "ফিল্ডার"],
  ["succeed"],
  ["corona", "করোনা"],
  ["carina", "ক্যারিনা"],
  ["starlet", "স্টারলেট"],
  ["prado", "প্রাডো"],
  ["x-trail", "xtrail", "এক্স ট্রেইল"],
  ["vezel", "ভেজেল", "ভেসেল"],
  ["civic", "সিভিক"],
  ["gixxer", "জিক্সার"],
  ["pulsar", "পালসার"],
  ["discover", "ডিসকভার"],
  ["apache", "অ্যাপাচি"],
  ["r15"],
];
// ট্রাক, পিকআপ, ভেকু ও আরও বাইক। b থাকলে পোস্টের ব্র্যান্ডও মিলতে হবে (ছোট নম্বর/শব্দ যাতে ভুল পোস্টে না মেলে)।
// names = সার্চে যা লিখতে পারে, keys = পোস্টে যা খোঁজা হবে
const MORE_MODELS: { names: string[]; keys: string[]; b?: string }[] = [
  ...["407", "709", "909", "912", "1109", "1212", "1615", "1613"].map((n) => ({
    names: [n], keys: [n, n.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)])], b: "tata",
  })),
  { names: ["ace", "tata ace", "এইস"], keys: ["ace", "এস ই"], b: "tata" },
  { names: ["ex2", "ex 2"], keys: ["ex2", "ex 2"], b: "tata" },
  { names: ["1114", "11.14"], keys: ["1114", "11 14"], b: "eicher" },
  { names: ["canter", "ক্যান্টার"], keys: ["canter", "ক্যান্টার"] },
  { names: ["dyna", "ডায়না"], keys: ["dyna", "ডায়না"] },
  { names: ["bolero", "বোলেরো"], keys: ["bolero", "বোলেরো"] },
  { names: ["e70b", "e70", "e-70b"], keys: ["e70", "e-70"] },
  { names: ["e120b", "e120"], keys: ["e120", "e-120"] },
  { names: ["e200b", "e200"], keys: ["e200", "e-200"] },
  { names: ["cat 307", "307d"], keys: ["cat 307", "307d", "307 d"] },
  { names: ["cat 320", "320d", "320b"], keys: ["cat 320", "320b", "320 d"] },
  { names: ["sk05", "sk 05"], keys: ["sk05", "sk 05"], b: "kobelco" },
  { names: ["sk60", "sk 60"], keys: ["sk60", "sk 60"], b: "kobelco" },
  { names: ["sh120"], keys: ["sh120", "sh 120"], b: "sumitomo" },
  { names: ["pc120"], keys: ["pc120", "pc 120"], b: "komatsu" },
  { names: ["fz", "fzs"], keys: ["fz"], b: "yamaha" },
  { names: ["mt15", "mt-15", "mt 15"], keys: ["mt-15", "mt15", "mt 15"], b: "yamaha" },
  { names: ["gsxr", "gsx-r"], keys: ["gsxr", "gsx-r"] },
  { names: ["hornet", "হর্নেট"], keys: ["hornet", "হর্নেট"] },
  { names: ["hunk", "হাঙ্ক"], keys: ["hunk", "হাঙ্ক"] },
  { names: ["splendor", "স্প্লেন্ডার"], keys: ["splendor", "স্প্লেন্ডার"] },
  { names: ["stryker"], keys: ["stryker"] },
  { names: ["metro"], keys: ["metro"], b: "tvs" },
];
const MODEL_KEY = "gb_searched_model_v1";
const nfc = (t: string) => t.normalize("NFC").toLowerCase();

const allModels = (): { names: string[]; keys: string[]; b?: string }[] =>
  SEARCH_MODELS.map((g) => ({ names: g, keys: g })).concat(MORE_MODELS);

export function rememberSearchedModel(query: string): void {
  const en = nfc(query).replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const q = " " + en.replace(/\s+/g, " ").trim() + " ";
  const hit = allModels().find((m) => m.names.some((n) => q.includes(" " + nfc(n) + " ")));
  if (!hit) return;
  try {
    localStorage.setItem(MODEL_KEY, hit.names[0]);
    window.dispatchEvent(new Event("gb:interest-changed"));
  } catch (_) {}
}

function searchedModelRules(): Array<Record<string, string | number>> {
  try {
    const k = localStorage.getItem(MODEL_KEY);
    const m = allModels().find((x) => x.names[0] === k);
    if (!m) return [];
    return m.keys.map((key) => {
      const o: Record<string, string | number> = { k: key.toLowerCase() };
      if (m.b) o.b = m.b;
      return o;
    });
  } catch (_) {
    return [];
  }
}

/** সার্ভারে পাঠানোর ছোট রূপ (শূন্য/ফাঁকা বাদ) */
export function savedSearchesPayload(): Array<Record<string, string | number>> {
  const saved = loadSavedSearches().map((s) => {
    const o: Record<string, string | number> = {};
    if (s.b) o.b = s.b;
    if (s.k) o.k = s.k;
    if (s.p) o.p = s.p;
    if (s.y1) o.y1 = s.y1;
    if (s.y2) o.y2 = s.y2;
    return o;
  });
  // সার্ভার সর্বোচ্চ ৫টা শর্ত দেখে; সেভ করা সার্চের পরে খালি ঘর থাকলে সর্বশেষ সার্চ করা মডেল যায়
  return saved.concat(searchedModelRules()).slice(0, MAX_SAVED_SEARCHES);
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
