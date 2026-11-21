import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bell, Plus } from "lucide-react";
import { PartListing, SupportedLanguage } from "../types";
import { loadInterest } from "../utils/feedRanker";
import { markNotifSeen } from "../utils/notifSeen";

// 🔔 নোটিফিকেশন ইনবক্স পেজ: ঘণ্টা চাপলে খোলে।
// কার্ডগুলো অ্যাপেই বানানো হয় (সার্ভার/খরচ লাগে না): ফোনে জমা পছন্দ (feedRanker) + লোড হওয়া পোস্ট থেকে।
//  - "Still looking for X?"  : বেশি দেখা মডেলের নতুন মিল
//  - "সেরা অফার"            : পছন্দের ব্র্যান্ডের পোস্ট
//  - "মিস করবেন না"         : গত ২ দিনের নতুন পোস্ট (পছন্দের ধরনে)
//  - "১ মিনিটে বিজ্ঞাপন দিন" : বিক্রেতা হওয়ার কার্ড

interface Props {
  language: SupportedLanguage;
  listings: PartListing[];
  notifOff: boolean;
  onEnable: () => void;
  onClose: () => void;
  onSelect: (l: PartListing) => void;
  onSell: () => void;
}

interface Card {
  id: string;
  kind: "list" | "sell";
  title: string;
  sub: string;
  date: string;
  items: PartListing[];
}

const norm = (v: unknown): string => (v == null ? "" : String(v)).trim().toLowerCase();
const cap = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());
const pic = (l: PartListing): string => l.image || (l.images && l.images[0]) || "";
const ts = (l: PartListing): number => {
  const t = new Date(l.createdAt as any).getTime();
  return Number.isFinite(t) ? t : 0;
};
const top = (map: Record<string, number>, min: number, n: number): string[] =>
  Object.entries(map || {})
    .filter(([, v]) => v >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);

const SUB_LABEL: Record<string, [string, string]> = {
  car: ["গাড়ি", "cars"],
  bike: ["বাইক", "bikes"],
  truck: ["ট্রাক", "trucks"],
  other_heavy_equipment: ["হেভি ইকুইপমেন্ট", "heavy equipment posts"],
};

export default function NotificationsInbox({ language, listings, notifOff, onEnable, onClose, onSelect, onSell }: Props) {
  const bn = language === "bn";
  const ownEntry = useRef(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // ফোনের back বোতাম এই পেজ বন্ধ করে (VideoFeed-এর মতো একটা history entry নিজের)
  useEffect(() => {
    try {
      window.history.pushState({ gbNotif: true }, "");
      ownEntry.current = true;
    } catch (_) {}
    const onPop = () => {
      ownEntry.current = false;
      onClose();
    };
    markNotifSeen();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const leave = (after?: () => void) => {
    if (ownEntry.current) {
      try { window.history.back(); } catch (_) {}
      window.setTimeout(() => {
        onClose();
        if (after) after();
      }, 80);
    } else {
      onClose();
      if (after) after();
    }
  };

  const fmtDate = (l?: PartListing): string => {
    if (!l) return "";
    const t = ts(l);
    if (!t) return "";
    try {
      return new Date(t).toLocaleDateString(bn ? "bn-BD" : "en-US", { month: "short", day: "numeric" });
    } catch (_) {
      return "";
    }
  };

  const cards = useMemo<Card[]>(() => {
    const out: Card[] = [];
    try {
      const alive = listings.filter((l) => !l.isSold && !!pic(l)).sort((a, b) => ts(b) - ts(a));
      const it = loadInterest();
      const used = new Set<string>();

      // 1) বেশি দেখা মডেলের নতুন মিল
      for (const m of top(it.m, 2, 2)) {
        const items = alive
          .filter((l) => {
            const lm = norm(l.model);
            return lm.length >= 3 && (lm.includes(m) || m.includes(lm));
          })
          .slice(0, 6);
        if (items.length === 0) continue;
        items.forEach((i) => used.add(i.id));
        out.push({
          id: "m-" + m,
          kind: "list",
          title: bn ? `আপনি কি ${cap(m)} খুঁজছেন?` : `Still looking for ${cap(m)}?`,
          sub: bn ? "আপনার খোঁজার মতো নতুন গাড়ি এসেছে!" : "Your search has new matches!",
          date: fmtDate(items[0]),
          items,
        });
      }

      // 2) পছন্দের ব্র্যান্ডের সেরা অফার
      for (const b of top(it.b, 1, 2)) {
        const items = alive.filter((l) => norm(l.brand) === b && !used.has(l.id)).slice(0, 6);
        if (items.length === 0) continue;
        items.forEach((i) => used.add(i.id));
        out.push({
          id: "b-" + b,
          kind: "list",
          title: bn ? `${cap(b)}-এর সেরা অফার 😍` : `Best ${cap(b)} offers for you 😍`,
          sub: bn ? "আপনার পছন্দের ব্র্যান্ডের নতুন পোস্ট" : "New posts from a brand you like",
          date: fmtDate(items[0]),
          items,
        });
      }

      // 3) গত ২ দিনের নতুন পোস্ট (পছন্দের ধরনে, না থাকলে সব)
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const fresh = alive.filter((l) => ts(l) > cutoff);
      const topSub = top(it.s, 1, 1)[0];
      const freshSub = topSub ? fresh.filter((l) => norm(l.subCategory) === topSub) : [];
      const pool = freshSub.length > 0 ? freshSub : fresh;
      if (pool.length > 0) {
        const lbl = SUB_LABEL[freshSub.length > 0 ? topSub : ""];
        const what = lbl ? (bn ? lbl[0] : lbl[1]) : bn ? "পোস্ট" : "posts";
        out.push({
          id: "fresh",
          kind: "list",
          title: bn ? "মিস করবেন না!" : "Don't miss these",
          sub: bn ? `গত ২ দিনে ${pool.length}টি নতুন ${what}` : `${pool.length} new ${what} in the last 2 days`,
          date: fmtDate(pool[0]),
          items: pool.slice(0, 6),
        });
      }

      // ইতিহাস/নতুন কিছুই না থাকলে সর্বশেষ পোস্ট
      if (out.length === 0 && alive.length > 0) {
        out.push({
          id: "latest",
          kind: "list",
          title: bn ? "নতুন পোস্ট দেখুন" : "See what's new",
          sub: bn ? "সর্বশেষ গাড়ি ও পার্টস" : "Latest cars and parts",
          date: fmtDate(alive[0]),
          items: alive.slice(0, 6),
        });
      }
    } catch (_) {}

    // 4) বিক্রেতা হওয়ার কার্ড
    out.push({
      id: "sell",
      kind: "sell",
      title: bn ? "১ মিনিটে বিজ্ঞাপন দিন!" : "Post an ad in 1 minute!",
      sub: bn ? "আপনার গাড়ি বা পার্টসের বিজ্ঞাপন ফ্রিতে দিন" : "Post free ads for your car or parts",
      date: "",
      items: [],
    });
    return out;
  }, [listings, language]);

  const priceText = (l: PartListing): string => {
    const p = Number(l.price);
    return Number.isFinite(p) && p > 0 ? "৳ " + Math.round(p).toLocaleString("en-IN") : bn ? "আলোচনা সাপেক্ষ" : "Negotiable";
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-slate-200 dark:border-slate-800">
        <button type="button" onClick={() => leave()} className="p-1 cursor-pointer" aria-label="Back">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-black">{bn ? "নোটিফিকেশন" : "Notifications"}</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {notifOff && (
          <button
            type="button"
            onClick={onEnable}
            className="w-full flex items-center gap-2 px-4 py-3 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-sm font-extrabold text-left cursor-pointer"
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span className="flex-1">{bn ? "নোটিফিকেশন বন্ধ আছে। চালু করুন" : "Notifications are off. Turn them on"}</span>
            <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black">{bn ? "চালু" : "On"}</span>
          </button>
        )}

        {cards.map((card) => {
          const isSell = card.kind === "sell";
          const open = openId === card.id;
          return (
            <div key={card.id} className="border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => (isSell ? leave(onSell) : setOpenId(open ? null : card.id))}
                className="w-full flex items-start gap-3 px-4 py-3.5 text-left cursor-pointer active:bg-slate-100 dark:active:bg-slate-900"
              >
                {isSell ? (
                  <div className="w-16 h-16 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                    <Plus className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-px bg-slate-300 dark:bg-slate-700 shrink-0">
                    {[0, 1, 2, 3].map((i) =>
                      card.items[i] ? (
                        <img key={i} src={pic(card.items[i])} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div key={i} className="bg-slate-200 dark:bg-slate-800" />
                      )
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-extrabold leading-snug">{card.title}</h3>
                    <span className="text-[11px] text-slate-400 font-bold shrink-0">{card.date}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400 font-semibold leading-snug">{card.sub}</p>
                </div>
              </button>

              {open && (
                <div className="px-4 pb-3 space-y-2">
                  {card.items.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => leave(() => onSelect(l))}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-left cursor-pointer"
                    >
                      <img src={pic(l)} alt="" loading="lazy" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-800" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{l.title || ((l.brand || "") + " " + (l.model || "")).trim()}</p>
                        <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400">{priceText(l)}</p>
                        {l.location && <p className="text-[11px] text-slate-400 font-semibold truncate">{l.location}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
