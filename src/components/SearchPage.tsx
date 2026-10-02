import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, X, SlidersHorizontal, MapPin, Clock, RotateCcw, Loader2 } from "lucide-react";
import { CITIES } from "../translations";
import { PartListing, SupportedLanguage } from "../types";
import { isItemVehicle, matchesSubCategoryFilter } from "../utils/listingFilters";
import { convertBengaliDigitsToEnglish, toPhoneticKey } from "../searchAliases";
import { searchListings } from "../utils/searchApi";

interface SearchPageProps {
  language: SupportedLanguage;
  listings: PartListing[];
  searchHistory: string[];
  onSaveHistory: (q: string) => void;
  onClose: () => void;
  onSelect: (listing: PartListing) => void;
}

type Filters = {
  type: string;
  brand: string;
  model: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
};

const EMPTY: Filters = { type: "all", brand: "", model: "", city: "all", minPrice: "", maxPrice: "", sort: "latest" };

const TYPES = [
  { id: "all", bn: "সব", en: "All" },
  { id: "car", bn: "কার", en: "Car" },
  { id: "bike", bn: "বাইক", en: "Bike" },
  { id: "truck", bn: "ট্রাক", en: "Truck" },
  { id: "other_heavy_equipment", bn: "হেভি ইকুইপ.", en: "Heavy Equip." },
  { id: "parts", bn: "পার্টস", en: "Parts" },
];


const SORTS = [
  { id: "latest", bn: "নতুন", en: "Newest" },
  { id: "priceAsc", bn: "দাম: কম", en: "Price: Low" },
  { id: "priceDesc", bn: "দাম: বেশি", en: "Price: High" },
];

const norm = (s: unknown) => String(s ?? "").toLowerCase();
const toNum = (s: string) => {
  const n = parseInt(convertBengaliDigitsToEnglish(s).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
const formatPrice = (p: number, bn: boolean) =>
  p > 0 ? `৳${p.toLocaleString("en-IN")}` : bn ? "মূল্য জানতে যোগাযোগ করুন" : "Contact for price";

const isPureAlpha = (s: string) => /^[a-z]+$/i.test(s) || /^[\u0980-\u09FF]+$/.test(s);

const hasWord = (hay: string, needle: string, strict: boolean): boolean => {
  if (!needle) return false;
  if (!isPureAlpha(needle)) return hay.includes(needle);
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const b = "[^a-zA-Z\\u0980-\\u09FF]";
  return new RegExp(`(^|${b})${esc}${strict ? `($|${b})` : ""}`, "i").test(hay);
};

const matches = (item: PartListing, f: Filters, tokens: string[]): boolean => {
  const any = item as any;
  const head = `${norm(item.title)} ${norm(any.brand)} ${norm(any.model)}`;
  const blob = `${head} ${norm(item.description)} ${norm(item.location)}`;

  if (tokens.length > 0) {
    const phoneticHead = toPhoneticKey(head);
    const ok = tokens.every(
      (t) => hasWord(blob, t, t.length <= 3) || (t.length > 2 && phoneticHead.includes(toPhoneticKey(t)))
    );
    if (!ok) return false;
  }

  if (f.type === "parts") {
    if (isItemVehicle(item)) return false;
  } else if (f.type !== "all") {
    if (!isItemVehicle(item) || !matchesSubCategoryFilter(item, f.type)) return false;
  }

  const brandQ = norm(f.brand);
  if (brandQ && !hasWord(head, brandQ, true)) return false;
  const modelQ = norm(f.model).trim();
  if (modelQ && !head.includes(modelQ)) return false;
  if (f.city !== "all" && !norm(item.location).includes(norm(f.city.split(" ")[0]))) return false;

  const price = Number(item.price) || 0;
  const min = toNum(f.minPrice);
  const max = toNum(f.maxPrice);
  if (min !== null && price < min) return false;
  if (max !== null && price > max) return false;
  return true;
};

export default function SearchPage({ language, listings, searchHistory, onSaveHistory, onClose, onSelect }: SearchPageProps) {
  const bn = language === "bn";
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [remote, setRemote] = useState<PartListing[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const activeCount =
    (filters.type !== "all" ? 1 : 0) +
    (filters.brand ? 1 : 0) +
    (filters.model.trim() ? 1 : 0) +
    (filters.city !== "all" ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0);

  const hasSearch = query.trim().length > 0 || activeCount > 0;

  const tokens = useMemo(
    () => convertBengaliDigitsToEnglish(query.toLowerCase()).split(/\s+/).filter(Boolean),
    [query]
  );

  useEffect(() => {
    if (!hasSearch) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchListings({
          tokens,
          type: filters.type,
          brand: filters.brand,
          model: filters.model,
          city: filters.city !== "all" ? filters.city.split(" ")[0] : "",
          minPrice: toNum(filters.minPrice),
          maxPrice: toNum(filters.maxPrice),
          sort: filters.sort,
        });
        if (id === reqId.current) setRemote(rows);
      } catch {
        if (id === reqId.current) setRemote([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [tokens, filters, hasSearch]);

  const results = useMemo(() => {
    const seen = new Set<string>();
    const pool: PartListing[] = [];
    for (const item of [...remote, ...listings]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      pool.push(item);
    }
    return pool
      .filter((item) => matches(item, filters, tokens))
      .sort((a, b) => {
        if (filters.sort === "priceAsc") return (Number(a.price) || 0) - (Number(b.price) || 0);
        if (filters.sort === "priceDesc") return (Number(b.price) || 0) - (Number(a.price) || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [remote, listings, filters, tokens]);

  const applyDraft = () => {
    setFilters(draft);
    setSheetOpen(false);
  };
  const submitQuery = () => {
    if (query.trim().length > 1) onSaveHistory(query);
  };
  const pick = (item: PartListing) => {
    submitQuery();
    onSelect(item);
  };

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.type !== "all") {
    const t = TYPES.find((x) => x.id === filters.type);
    activeChips.push({ key: "type", label: bn ? t?.bn || "" : t?.en || "", clear: () => setFilters({ ...filters, type: "all" }) });
  }
  if (filters.brand) activeChips.push({ key: "brand", label: filters.brand, clear: () => setFilters({ ...filters, brand: "" }) });
  if (filters.model.trim()) activeChips.push({ key: "model", label: filters.model.trim(), clear: () => setFilters({ ...filters, model: "" }) });
  if (filters.city !== "all") activeChips.push({ key: "city", label: filters.city.split(" (")[0], clear: () => setFilters({ ...filters, city: "all" }) });
  if (filters.minPrice || filters.maxPrice) {
    activeChips.push({
      key: "price",
      label: `৳${filters.minPrice || "0"} - ${filters.maxPrice ? "৳" + filters.maxPrice : "∞"}`,
      clear: () => setFilters({ ...filters, minPrice: "", maxPrice: "" }),
    });
  }

  const chipBase = "shrink-0 px-3.5 py-2 rounded-full text-xs font-extrabold border transition cursor-pointer";
  const chipOn = "bg-amber-500 border-amber-500 text-slate-950";
  const chipOff = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300";
  const inputCls =
    "w-full bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30";
  const labelCls = "text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2";

  // The advanced-search form: shown directly when the search page opens, and
  // again inside the bottom sheet once results are on screen.
  const filterForm = (
    <div className="space-y-5">
      <div>
        <p className={labelCls}>{bn ? "ধরন" : "Type"}</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => setDraft({ ...draft, type: t.id })} className={`${chipBase} ${draft.type === t.id ? chipOn : chipOff}`}>
              {bn ? t.bn : t.en}
            </button>
          ))}
        </div>
      </div>


      <div>
        <p className={labelCls}>{bn ? "গাড়ির মডেল" : "Model"}</p>
        <input
          type="text"
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          placeholder={bn ? "যেমন: Axio, Corolla, Noah" : "e.g. Axio, Corolla, Noah"}
          className={inputCls}
        />
      </div>

      <div>
        <p className={labelCls}>{bn ? "ঠিকানা / শহর" : "Location"}</p>
        <select value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className={inputCls}>
          <option value="all">{bn ? "সব শহর" : "All cities"}</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <p className={labelCls}>{bn ? "দামের পরিসীমা (৳)" : "Price range (৳)"}</p>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="numeric" value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} placeholder={bn ? "সর্বনিম্ন" : "Min"} className={inputCls} />
          <span className="text-slate-400 font-bold">–</span>
          <input type="text" inputMode="numeric" value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder={bn ? "সর্বোচ্চ" : "Max"} className={inputCls} />
        </div>
      </div>
    </div>
  );

  const applyBtn = (
    <button type="button" onClick={applyDraft} className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-md cursor-pointer">
      {bn ? "ফলাফল দেখুন" : "Show results"}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-50 dark:bg-slate-950 flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onClose} className="p-2 -ml-1 rounded-full text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitQuery(); }}
            placeholder={bn ? "গাড়ি, মডেল বা পার্টস খুঁজুন..." : "Search cars, models or parts..."}
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          {query.length > 0 && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setDraft(filters); setSheetOpen(true); }}
          className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer border ${
            activeCount > 0 ? "bg-amber-500 border-amber-500 text-slate-950" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          }`}
          aria-label={bn ? "অ্যাডভান্সড সার্চ" : "Advanced search"}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          {activeChips.map((c) => (
            <button key={c.key} type="button" onClick={c.clear} className="shrink-0 flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-extrabold cursor-pointer">
              <span>{c.label}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          ))}
          <button type="button" onClick={() => setFilters(EMPTY)} className="shrink-0 px-2 py-1.5 text-xs font-bold text-rose-500 cursor-pointer">
            {bn ? "সব মুছুন" : "Clear all"}
          </button>
        </div>
      )}

      {/* Body */}
      {!hasSearch ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            {searchHistory.length > 0 && (
              <div className="mb-5">
                <p className={labelCls}>{bn ? "সাম্প্রতিক খোঁজ" : "Recent searches"}</p>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((h) => (
                    <button key={h} type="button" onClick={() => setQuery(h)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="max-w-[140px] truncate">{h}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-800 dark:text-white">{bn ? "অ্যাডভান্সড সার্চ" : "Advanced Search"}</h3>
              <button type="button" onClick={() => setDraft(EMPTY)} className="flex items-center gap-1 text-xs font-extrabold text-rose-500 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />
                {bn ? "রিসেট" : "Reset"}
              </button>
            </div>
            {filterForm}
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            {applyBtn}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-10">
          <div className="pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                {bn ? `${results.length}টি ফলাফল` : `${results.length} results`}
              </p>
              <div className="flex gap-1.5">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFilters({ ...filters, sort: s.id })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold cursor-pointer ${filters.sort === s.id ? "bg-amber-500 text-slate-950" : "bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                  >
                    {bn ? s.bn : s.en}
                  </button>
                ))}
              </div>
            </div>

            {results.length === 0 ? (
              loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{bn ? "কিছু পাওয়া যায়নি" : "Nothing found"}</p>
                  <p className="text-xs text-slate-400 mt-1">{bn ? "ফিল্টার কমিয়ে বা বানান বদলে চেষ্টা করুন" : "Try fewer filters or a different spelling"}</p>
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item)}
                    className="w-full flex gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm text-left active:scale-[0.99] transition cursor-pointer"
                  >
                    <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0">
                      {(item as any).image && <img src={(item as any).image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-start gap-1.5">
                          <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug flex-1">{item.title}</p>
                          {item.isAd && <span className="shrink-0 text-[9px] font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">{bn ? "বিজ্ঞাপন" : "AD"}</span>}
                        </div>
                        <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mt-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </p>
                      </div>
                      <p className="text-sm font-black text-amber-600 dark:text-amber-400">{formatPrice(Number(item.price) || 0, bn)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter sheet (while results are showing) */}
      {sheetOpen && hasSearch && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-3">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">{bn ? "অ্যাডভান্সড সার্চ" : "Advanced Search"}</h3>
              <button type="button" onClick={() => setDraft(EMPTY)} className="flex items-center gap-1 text-xs font-extrabold text-rose-500 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />
                {bn ? "রিসেট" : "Reset"}
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4">{filterForm}</div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              {applyBtn}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
