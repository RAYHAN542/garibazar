import { useCallback, useEffect, useRef, useState } from "react";
import { isNativeAdsSupported } from "../utils/nativeAds";
import { showTimedInterstitial } from "../hooks/useVideoInterstitial";
import type { FormEvent } from "react";
import { Search, Play } from "lucide-react";
import type { SupportedLanguage } from "../types";
import { nativeFetch } from "../utils/nativeFetch";
import { apiUrl } from "../utils/apiBase";

// ------------------------------------------------------------------------
// "মেকানিক টিপস" tab inside the video feed.
// People search a car problem; results come from YouTube through our own
// server (api/account-actions.ts, action "youtube_search" -- cached, key
// hidden). Videos are shown as a list:
// a thumbnail first, and the official YouTube player only loads when the
// person taps a video (one player at a time), so the phone stays fast.
// Nothing is ever placed on top of the YouTube player (YouTube policy) --
// title/channel/links sit below it.
// ------------------------------------------------------------------------

interface TipItem {
  id: string;
  title: string;
  channel: string;
}

interface TipsFeedProps {
  language: SupportedLanguage;
}

const DEFAULT_QUERY = "গাড়ির সমস্যা ও সমাধান মেকানিক";

type Chip = { bn: string; en: string; q: string };
const TYPES: { key: string; icon: string; bn: string; en: string; kw: string; base: string; chips: Chip[] }[] = [
  {
    key: "car", icon: "🚗", bn: "গাড়ি", en: "Car", kw: "গাড়ির", base: DEFAULT_QUERY,
    chips: [
      { bn: "ব্রেক সমস্যা", en: "Brake problem", q: "গাড়ির ব্রেক সমস্যা সমাধান" },
      { bn: "AC ঠান্ডা হয় না", en: "AC not cooling", q: "গাড়ির এসি ঠান্ডা হয় না সমাধান" },
      { bn: "ব্যাটারি ডাউন", en: "Battery problem", q: "গাড়ির ব্যাটারি সমস্যা সমাধান" },
      { bn: "ইঞ্জিন গরম", en: "Engine overheating", q: "ইঞ্জিন গরম হওয়ার সমস্যা সমাধান" },
      { bn: "গিয়ার সমস্যা", en: "Gear problem", q: "গাড়ির গিয়ার সমস্যা সমাধান" },
      { bn: "স্টার্ট হয় না", en: "Won't start", q: "গাড়ি স্টার্ট হয় না সমাধান" },
    ],
  },
  {
    key: "bike", icon: "🏍️", bn: "বাইক", en: "Bike", kw: "বাইকের", base: "বাইক মোটরসাইকেল সমস্যা ও সমাধান মেকানিক",
    chips: [
      { bn: "স্টার্ট হয় না", en: "Won't start", q: "বাইক স্টার্ট হয় না সমাধান" },
      { bn: "ব্রেক সমস্যা", en: "Brake problem", q: "বাইকের ব্রেক সমস্যা সমাধান" },
      { bn: "ইঞ্জিন গরম", en: "Engine overheating", q: "বাইকের ইঞ্জিন গরম হওয়ার সমস্যা সমাধান" },
      { bn: "চেইন সমস্যা", en: "Chain problem", q: "বাইকের চেইন সমস্যা সমাধান" },
      { bn: "ব্যাটারি সমস্যা", en: "Battery problem", q: "বাইকের ব্যাটারি সমস্যা সমাধান" },
      { bn: "ক্লাচ গিয়ার", en: "Clutch & gear", q: "বাইকের ক্লাচ গিয়ার সমস্যা সমাধান" },
    ],
  },
  {
    key: "truck", icon: "🚚", bn: "ট্রাক", en: "Truck", kw: "ট্রাকের", base: "ট্রাক সমস্যা ও সমাধান মেকানিক",
    chips: [
      { bn: "ইঞ্জিন গরম", en: "Engine overheating", q: "ট্রাকের ইঞ্জিন গরম হওয়ার সমস্যা সমাধান" },
      { bn: "এয়ার ব্রেক", en: "Air brake", q: "ট্রাকের এয়ার ব্রেক সমস্যা সমাধান" },
      { bn: "গিয়ারবক্স", en: "Gearbox", q: "ট্রাকের গিয়ারবক্স সমস্যা সমাধান" },
      { bn: "কালো ধোঁয়া", en: "Black smoke", q: "ট্রাকের কালো ধোঁয়া সমস্যা সমাধান" },
      { bn: "স্টার্ট হয় না", en: "Won't start", q: "ট্রাক স্টার্ট হয় না সমাধান" },
      { bn: "টায়ার সমস্যা", en: "Tyre problem", q: "ট্রাকের টায়ার সমস্যা সমাধান" },
    ],
  },
  {
    key: "excavator", icon: "🏗️", bn: "এক্সকাভেটর", en: "Excavator", kw: "এক্সকাভেটরের", base: "এক্সকাভেটর সমস্যা ও সমাধান মেকানিক",
    chips: [
      { bn: "হাইড্রলিক", en: "Hydraulic", q: "এক্সকাভেটর হাইড্রলিক সমস্যা সমাধান" },
      { bn: "ইঞ্জিন সমস্যা", en: "Engine problem", q: "এক্সকাভেটর ইঞ্জিন সমস্যা সমাধান" },
      { bn: "ট্র্যাক চেইন", en: "Track chain", q: "এক্সকাভেটর ট্র্যাক চেইন সমস্যা সমাধান" },
      { bn: "সুইং সমস্যা", en: "Swing problem", q: "এক্সকাভেটর সুইং সমস্যা সমাধান" },
      { bn: "স্টার্ট হয় না", en: "Won't start", q: "এক্সকাভেটর স্টার্ট হয় না সমাধান" },
      { bn: "বুম ও আর্ম", en: "Boom & arm", q: "এক্সকাভেটর বুম আর্ম সমস্যা সমাধান" },
    ],
  },
];

export default function TipsFeed({ language }: TipsFeedProps) {
  const bn = language === "bn";
  const [input, setInput] = useState("");
  const [items, setItems] = useState<TipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const reqId = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef<string | null>(null);
  const soundRef = useRef(false);
  const [autoPlayed, setAutoPlayed] = useState(false);
  const [vehicleType, setVehicleType] = useState("car");

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 2) return;
      const ck = "tips_cache_v1:" + q.toLowerCase();
      try {
        const raw = localStorage.getItem(ck);
        if (raw) {
          const c = JSON.parse(raw);
          if (c && Array.isArray(c.items) && c.items.length > 0 && Date.now() - c.t < 6 * 60 * 60 * 1000) {
            ++reqId.current;
            setError(null);
            setPlayingId(null);
            setItems(c.items as TipItem[]);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}
      const my = ++reqId.current;
      setLoading(true);
      setError(null);
      setPlayingId(null);
      try {
        const resp = await nativeFetch(apiUrl("/api/account-actions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "youtube_search", q }),
        });
        const data = await resp.json().catch(() => null);
        if (my !== reqId.current) return;
        if (!resp.ok) {
          setItems([]);
          setError((data && data.error) || (bn ? "ভিডিও আনা যায়নি। আবার চেষ্টা করুন।" : "Could not load videos. Please try again."));
          return;
        }
        const list = Array.isArray(data?.items) ? (data.items as TipItem[]) : [];
        setItems(list);
        if (list.length > 0) {
          try {
            localStorage.setItem(ck, JSON.stringify({ t: Date.now(), items: list }));
          } catch (_) {}
        }
      } catch (_) {
        if (my !== reqId.current) return;
        setItems([]);
        setError(bn ? "ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।" : "Check your internet connection and try again.");
      } finally {
        if (my === reqId.current) setLoading(false);
      }
    },
    [bn]
  );

  useEffect(() => {
    runSearch(DEFAULT_QUERY);
  }, [runSearch]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = TYPES.find((x) => x.key === vehicleType) || TYPES[0];
    const typed = input.trim();
    runSearch(typed ? t.kw + " " + typed : t.base);
  };

  playingRef.current = playingId;

  // Auto-play: only the card that is >=60% visible and stays put ~0.7s plays,
  // one at a time (YouTube policy). Auto-started videos begin muted.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || loading || items.length === 0 || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const share = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const c = root.getBoundingClientRect();
      const vis = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
      return r.height > 0 ? vis / r.height : 0;
    };
    const pick = () => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-vid]"));
      const cur = playingRef.current;
      if (cur) {
        const curEl = cards.find((el) => el.dataset.vid === cur);
        if (curEl && share(curEl) >= 0.6) return;
      }
      const next = cards.find((el) => share(el) >= 0.6);
      const id = next?.dataset.vid;
      if (!id || id === cur) return;
      setAutoPlayed(!soundRef.current);
      setPlayingId(id);
    };
    const obs = new IntersectionObserver(
      () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(pick, 700);
      },
      { root, threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    );
    root.querySelectorAll("[data-vid]").forEach((n) => obs.observe(n));
    return () => {
      window.clearTimeout(timer);
      obs.disconnect();
    };
  }, [items, loading]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div
      ref={scrollRef}
      onClick={() => {
        soundRef.current = true;
      }}
      className="h-full w-full overflow-y-auto overscroll-contain bg-black text-white no-scrollbar"
      style={{ paddingTop: "calc(3.5rem + env(safe-area-inset-top))" }}
    >
      <div className="px-3 pt-2 pb-3">
        <h2 className="text-base font-black leading-snug">
          {bn ? "মেকানিক টিপস — গাড়ির সমস্যার সমাধান" : "Mechanic Tips — fix car problems"}
        </h2>

        <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={80}
            placeholder={bn ? "সমস্যা লিখুন, যেমন: ব্রেক শব্দ করে" : "Type a problem, e.g. brake noise"}
            className="min-w-0 flex-1 h-10 rounded-full bg-white/10 px-4 text-sm text-white placeholder-white/50 outline-none"
          />
          <button
            type="submit"
            aria-label={bn ? "সার্চ" : "Search"}
            className="h-10 w-10 shrink-0 rounded-full bg-white flex items-center justify-center text-black cursor-pointer"
          >
            <Search className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {TYPES.map((t) => {
            const on = t.key === vehicleType;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setVehicleType(t.key);
                  setInput("");
                  runSearch(t.base);
                }}
                className={`rounded-xl px-1 py-2 text-xs font-extrabold flex flex-col items-center gap-0.5 cursor-pointer ${
                  on ? "bg-white text-black" : "bg-white/10 text-white"
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{bn ? t.bn : t.en}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(TYPES.find((x) => x.key === vehicleType) || TYPES[0]).chips.map((c) => (
            <button
              key={c.q}
              type="button"
              onClick={() => {
                setInput(bn ? c.bn : c.en);
                runSearch(c.q);
              }}
              className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              {bn ? c.bn : c.en}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="px-3 pb-4 space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white/10 animate-pulse">
              <div className="w-full aspect-video bg-white/10" />
              <div className="px-3 py-3 space-y-2">
                <div className="h-3.5 w-11/12 rounded bg-white/15" />
                <div className="h-3 w-1/3 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mx-3 rounded-xl bg-red-500/15 px-4 py-3 text-center text-sm font-semibold text-red-300">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="px-4 py-6 text-center text-sm font-semibold text-white/70">
          {bn ? "কোনো ভিডিও পাওয়া যায়নি। অন্যভাবে লিখে সার্চ করুন।" : "No videos found. Try different words."}
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="px-3 pb-4 space-y-4">
          {items.map((v) => {
            const playing = playingId === v.id;
            return (
              <div key={v.id} data-vid={v.id} className="rounded-2xl overflow-hidden bg-white text-black">
                <div className="relative w-full aspect-video bg-black">
                  {playing ? (
                    <iframe
                      className="absolute inset-0 h-full w-full border-0"
                      src={`https://www.youtube.com/embed/${v.id}?autoplay=1&mute=${autoPlayed ? 1 : 0}&playsinline=1&rel=0&origin=${encodeURIComponent(origin)}`}
                      title={v.title}
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setAutoPlayed(false);
                        soundRef.current = true;
                        if (isNativeAdsSupported()) await showTimedInterstitial();
                        setPlayingId(v.id);
                      }}
                      aria-label={bn ? "ভিডিও চালান" : "Play video"}
                      className="absolute inset-0 h-full w-full cursor-pointer"
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-7 h-7 fill-white text-white" />
                      </span>
                    </button>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <h3 className="text-sm font-extrabold leading-snug line-clamp-2 text-black">{v.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-neutral-600 line-clamp-1">{v.channel}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-4 pb-8 pt-2 text-center text-[11px] leading-relaxed text-white/50">
        {bn ? "ভিডিওগুলো YouTube থেকে দেখানো হচ্ছে। " : "Videos are provided by YouTube. "}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline">
          YouTube Terms of Service
        </a>
        {" · "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
          Google Privacy Policy
        </a>
      </p>
    </div>
  );
}
