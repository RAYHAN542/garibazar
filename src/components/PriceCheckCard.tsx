import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "../supabase";
import { PartListing, SupportedLanguage } from "../types";

// 📊 "এই দামটা কি ঠিক?" -- পোস্ট ডিটেইলে দামের নিচে। ট্যাপ করলে একই ব্র্যান্ড/ধরন/মডেল/বছরের (±২)
// অন্য পোস্টের দামের সাথে মিলিয়ে দেখায়। হিসাব Supabase ফাংশন similar_price_stats থেকে।
// শুধু এই অ্যাপের পোস্টের হিসাব -- আসল বাজারদর নয়, তাই নিচে সতর্কবার্তা আছে।

interface Stats {
  n: number;
  p25: number;
  median: number;
  p75: number;
}

const fmt = (v: number): string => "৳" + Math.round(v).toLocaleString("en-IN");

export default function PriceCheckCard({ listing, language, isSold }: { listing: PartListing; language: SupportedLanguage; isSold: boolean }) {
  const bn = language === "bn";
  const price = Number(listing.price);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  if (!(price > 0) || isSold) return null;

  const toggle = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (!willOpen || stats || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const { data, error } = await supabase.rpc("similar_price_stats", {
        p_brand: listing.brand || "",
        p_model: listing.model || "",
        p_title: listing.title || "",
        p_sub: (listing as any).subCategory || "",
        p_exclude: String(listing.id),
      });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      setStats({
        n: Number(row?.n) || 0,
        p25: Number(row?.p25) || 0,
        median: Number(row?.median) || 0,
        p75: Number(row?.p75) || 0,
      });
    } catch (_) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  let verdict: { text: string; cls: string } | null = null;
  if (stats && stats.n >= 3 && stats.median > 0) {
    const diff = Math.round((Math.abs(price - stats.median) / stats.median) * 100);
    if (price < stats.p25) {
      verdict = {
        text: bn ? `দাম কম (মধ্যম দামের চেয়ে প্রায় ${diff}% কম) — কাগজ আর গাড়ির অবস্থা ভালো করে দেখে নিন` : `Lower than usual (about ${diff}% below median) — check papers and condition carefully`,
        cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
      };
    } else if (price <= stats.p75) {
      verdict = {
        text: bn ? "দাম ঠিকঠাক, সাধারণ দামের ভেতরেই" : "Fair price, within the usual range",
        cls: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
      };
    } else {
      verdict = {
        text: bn ? `দাম একটু বেশি (মধ্যম দামের চেয়ে প্রায় ${diff}% বেশি) — দরদাম করে দেখতে পারেন` : `Higher than usual (about ${diff}% above median) — you can try negotiating`,
        cls: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
      };
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <button type="button" onClick={toggle} className="w-full p-3.5 flex items-center justify-between gap-3 text-left cursor-pointer">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{bn ? "📊 এই দামটা কি ঠিক?" : "📊 Is this price fair?"}</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {bn ? "একই ধরনের অন্য গাড়ির দামের সাথে মিলিয়ে দেখুন" : "Compare with similar posts"}
          </p>
        </div>
        <ChevronRight className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5">
          {loading && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {bn ? "হিসাব করা হচ্ছে..." : "Calculating..."}
            </div>
          )}

          {failed && <p className="text-xs font-bold text-red-500">{bn ? "এখন হিসাব আনা যায়নি, পরে আবার চেষ্টা করুন" : "Couldn't load right now. Try again later"}</p>}

          {stats && stats.n < 3 && (
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              {bn
                ? `তুলনা করার মতো যথেষ্ট একই ধরনের পোস্ট নেই (পাওয়া গেছে ${stats.n}টি, অন্তত ৩টা লাগে)।`
                : `Not enough similar posts to compare (found ${stats.n}, need at least 3).`}
            </p>
          )}

          {stats && stats.n >= 3 && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400">{bn ? "কম দিকে" : "Low end"}</p>
                  <p className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">{fmt(stats.p25)}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{bn ? "মধ্যম দাম" : "Median"}</p>
                  <p className="text-xs font-black font-mono text-amber-600 dark:text-amber-400">{fmt(stats.median)}</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400">{bn ? "বেশি দিকে" : "High end"}</p>
                  <p className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">{fmt(stats.p75)}</p>
                </div>
              </div>
              {verdict && <p className={`p-2.5 rounded-lg border text-xs font-black leading-relaxed ${verdict.cls}`}>{verdict.text}</p>}
              <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                {bn
                  ? `এই অ্যাপের ${stats.n}টি একই ধরনের পোস্টের হিসাব। গাড়ির অবস্থা, মাইলেজ আর কাগজ ভেদে দাম বদলায়, তাই কেনার আগে নিজে দেখে নিন।`
                  : `Based on ${stats.n} similar posts in this app. Condition, mileage and papers change the price, so check before buying.`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
