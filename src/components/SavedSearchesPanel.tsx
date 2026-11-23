import { useEffect, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { SupportedLanguage } from "../types";
import {
  addSavedSearch,
  describeSavedSearch,
  loadSavedSearches,
  removeSavedSearch,
  MAX_SAVED_SEARCHES,
  SavedSearch,
} from "../utils/savedSearches";

// 🔎 "আমি খুঁজছি" প্যানেল (নোটিফিকেশন ইনবক্সের উপরে): ক্রেতা বলে দেয় কোন গাড়ি খুঁজছে,
// এমন গাড়ি পোস্ট হলেই পুশ নোটিফিকেশন যায়। সর্বোচ্চ ৫টা, ফোনে জমা থাকে।

const toEn = (s: string): string =>
  s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[,\s]/g, "");

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500";

export default function SavedSearchesPanel({ language }: { language: SupportedLanguage }) {
  const bn = language === "bn";
  const [list, setList] = useState<SavedSearch[]>(() => loadSavedSearches());
  const [open, setOpen] = useState(false);
  const [b, setB] = useState("");
  const [k, setK] = useState("");
  const [y1, setY1] = useState("");
  const [y2, setY2] = useState("");
  const [p, setP] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const h = () => setList(loadSavedSearches());
    window.addEventListener("gb:saved-searches", h);
    return () => window.removeEventListener("gb:saved-searches", h);
  }, []);

  const save = () => {
    const r = addSavedSearch({ b, k, p: toEn(p), y1: toEn(y1), y2: toEn(y2) });
    if (r === "empty") {
      setMsg({ ok: false, text: bn ? "ব্র্যান্ড বা মডেলের নাম অন্তত একটা লিখুন" : "Enter at least a brand or a model" });
    } else if (r === "full") {
      setMsg({ ok: false, text: bn ? `সর্বোচ্চ ${MAX_SAVED_SEARCHES}টা সার্চ রাখা যায়। আগে একটা মুছুন` : `You can keep up to ${MAX_SAVED_SEARCHES} searches. Remove one first` });
    } else {
      setB(""); setK(""); setY1(""); setY2(""); setP("");
      setOpen(false);
      setMsg({ ok: true, text: bn ? "সেভ হয়েছে ✅ এমন গাড়ি পোস্ট হলেই নোটিফিকেশন পাবেন" : "Saved ✅ You'll get a notification when a matching car is posted" });
    }
  };

  return (
    <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <Search className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold leading-snug">{bn ? "আমি খুঁজছি" : "I'm looking for"}</p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">
              {bn ? "এমন গাড়ি পোস্ট হলেই জানিয়ে দেব" : "We'll notify you when one is posted"}
            </p>
          </div>
        </div>
        {list.length < MAX_SAVED_SEARCHES && !open && (
          <button
            type="button"
            onClick={() => { setMsg(null); setOpen(true); }}
            className="px-3 py-1.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {bn ? "যোগ করুন" : "Add"}
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div className="mt-3 space-y-2">
          {list.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[13px] font-bold truncate">{describeSavedSearch(s, bn)}</span>
              <button type="button" onClick={() => removeSavedSearch(s.id)} className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0" aria-label="Remove">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input className={inputCls} value={b} onChange={(e) => setB(e.target.value)} placeholder={bn ? "ব্র্যান্ড (Toyota)" : "Brand (Toyota)"} maxLength={30} />
            <input className={inputCls} value={k} onChange={(e) => setK(e.target.value)} placeholder={bn ? "মডেল (Axio)" : "Model (Axio)"} maxLength={30} />
            <input className={inputCls} value={y1} onChange={(e) => setY1(e.target.value)} placeholder={bn ? "বছর থেকে (2010)" : "Year from (2010)"} inputMode="numeric" maxLength={4} />
            <input className={inputCls} value={y2} onChange={(e) => setY2(e.target.value)} placeholder={bn ? "বছর পর্যন্ত (2014)" : "Year to (2014)"} inputMode="numeric" maxLength={4} />
          </div>
          <input className={inputCls} value={p} onChange={(e) => setP(e.target.value)} placeholder={bn ? "সর্বোচ্চ দাম টাকায় (1000000)" : "Max price in taka (1000000)"} inputMode="numeric" maxLength={11} />
          <div className="flex gap-2.5">
            <button type="button" onClick={save} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-950 text-sm font-black cursor-pointer">
              {bn ? "সংরক্ষণ করুন" : "Save"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setMsg(null); }} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold cursor-pointer">
              {bn ? "বাতিল" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-2.5 text-xs font-bold ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{msg.text}</p>
      )}
    </div>
  );
}
