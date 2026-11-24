import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { supabase } from "../supabase";
import { SupportedLanguage } from "../types";

// 📊 গাড়ির বাজার দামের রিপোর্ট: গত ৬ মাসের পোস্ট থেকে ব্র্যান্ড-মডেল (আর বছর) অনুযায়ী দামের সীমা।
// সবাই দেখতে পারে। কারো পোস্টকে "বেশি/কম" বলা হয় না -- শুধু বাজারের ছবি দেখানো হয়।
// ডেটা আসে Supabase ফাংশন market_price_report() থেকে।

interface Row {
  brand: string;
  model: string;
  yr: number | null;
  is_total: boolean;
  n: number;
  p25: number;
  median: number;
  p75: number;
}

interface Group {
  key: string;
  brand: string;
  model: string;
  total: Row;
  years: Row[];
}

const cap = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());

const fmt = (v: number, bn: boolean): string => {
  if (v >= 10000000) return (v / 10000000).toFixed(1).replace(/\.0$/, "") + (bn ? " কোটি" : " crore");
  if (v >= 100000) return (v / 100000).toFixed(1).replace(/\.0$/, "") + (bn ? " লাখ" : " lakh");
  return Math.round(v).toLocaleString("en-IN");
};

export default function MarketReportPage({ language, onClose }: { language: SupportedLanguage; onClose: () => void }) {
  const bn = language === "bn";
  const ownEntry = useRef(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  // ফোনের back বোতাম এই পেজ বন্ধ করে (ইনবক্সের মতো নিজের একটা history entry)
  useEffect(() => {
    try {
      window.history.pushState({ gbReport: true }, "");
      ownEntry.current = true;
    } catch (_) {}
    const onPop = () => {
      ownEntry.current = false;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const leave = () => {
    if (ownEntry.current) {
      try { window.history.back(); } catch (_) {}
      window.setTimeout(() => onClose(), 80);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("market_price_report");
        if (error) throw error;
        const list: Row[] = (Array.isArray(data) ? data : []).map((r: any) => ({
          brand: String(r.brand || ""),
          model: String(r.model || ""),
          yr: r.yr == null ? null : Number(r.yr),
          is_total: !!r.is_total,
          n: Number(r.n) || 0,
          p25: Number(r.p25) || 0,
          median: Number(r.median) || 0,
          p75: Number(r.p75) || 0,
        }));
        if (alive) setRows(list);
      } catch (_) {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    (rows || []).forEach((r) => {
      const key = r.brand + "|" + r.model;
      let g = map.get(key);
      if (!g) {
        g = { key, brand: r.brand, model: r.model, total: null as unknown as Row, years: [] };
        map.set(key, g);
      }
      if (r.is_total) g.total = r;
      else g.years.push(r);
    });
    return Array.from(map.values())
      .filter((g) => !!g.total)
      .sort((a, b) => b.total.n - a.total.n);
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.brand + " " + g.model).includes(q));
  }, [groups, query]);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-slate-200 dark:border-slate-800">
        <button type="button" onClick={leave} className="p-1 cursor-pointer" aria-label="Back">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-black">{bn ? "📊 গাড়ির বাজার দাম" : "📊 Car market prices"}</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
            {bn
              ? "গত ৬ মাসে এই অ্যাপে আসা পোস্ট থেকে হিসাব। কোন গাড়ি সাধারণত কত দামে আসে সেটা বোঝার জন্য।"
              : "Based on posts in this app over the last 6 months, to show what each car usually sells for."}
          </p>
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={bn ? "গাড়ি খুঁজুন (যেমন axio)" : "Search a car (e.g. axio)"}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {!rows && !failed && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {bn ? "লোড হচ্ছে..." : "Loading..."}
          </div>
        )}
        {failed && (
          <p className="px-4 py-10 text-center text-sm font-bold text-red-500">
            {bn ? "এখন লোড করা যায়নি, পরে আবার চেষ্টা করুন" : "Couldn't load right now. Try again later"}
          </p>
        )}
        {rows && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
            {bn ? "কোনো গাড়ি পাওয়া যায়নি" : "No cars found"}
          </p>
        )}

        {shown.map((g) => {
          const open = openKey === g.key;
          return (
            <div key={g.key} className="border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : g.key)}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer active:bg-slate-100 dark:active:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold leading-snug">
                    {cap(g.brand)} {cap(g.model)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {bn ? `${g.total.n}টি পোস্ট থেকে` : `From ${g.total.n} posts`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                      ৳{fmt(g.total.p25, bn)} – ৳{fmt(g.total.p75, bn)}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {bn ? "মধ্যম" : "Median"} ৳{fmt(g.total.median, bn)}
                    </p>
                  </div>
                  {g.years.length > 0 && (
                    <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
                  )}
                </div>
              </button>

              {open && g.years.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{bn ? "বছর অনুযায়ী" : "By year"}</p>
                  {g.years.map((y) => (
                    <div
                      key={String(y.yr)}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <span className="text-sm font-black">{y.yr}</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{bn ? `${y.n}টি পোস্ট` : `${y.n} posts`}</span>
                      <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                        ৳{fmt(y.p25, bn)} – ৳{fmt(y.p75, bn)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {rows && (
          <p className="px-4 py-5 text-[11px] font-semibold text-slate-400 leading-relaxed">
            {bn
              ? "দামের সীমা মানে মাঝামাঝি অর্ধেক পোস্টের দাম (খুব কম বা খুব বেশি দাম বাদ)। গাড়ির অবস্থা, মাইলেজ আর কাগজ ভেদে দাম বদলায়, তাই এটা শুধু ধারণা পাওয়ার জন্য। কারো দাম ঠিক বা ভুল বলার জন্য নয়।"
              : "The range covers the middle half of posts (very low and very high prices left out). Condition, mileage and papers change prices, so this is only a guide, not a judgment of anyone's price."}
          </p>
        )}
      </div>
    </div>
  );
}
