import { useCallback, useEffect, useRef, useState } from "react";
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

const CHIPS: { bn: string; en: string; q: string }[] = [
  { bn: "ব্রেক সমস্যা", en: "Brake problem", q: "গাড়ির ব্রেক সমস্যা সমাধান" },
  { bn: "AC ঠান্ডা হয় না", en: "AC not cooling", q: "গাড়ির এসি ঠান্ডা হয় না সমাধান" },
  { bn: "ব্যাটারি ডাউন", en: "Battery problem", q: "গাড়ির ব্যাটারি সমস্যা সমাধান" },
  { bn: "ইঞ্জিন গরম", en: "Engine overheating", q: "ইঞ্জিন গরম হওয়ার সমস্যা সমাধান" },
  { bn: "গিয়ার সমস্যা", en: "Gear problem", q: "গাড়ির গিয়ার সমস্যা সমাধান" },
  { bn: "এক্সকাভেটর হাইড্রলিক", en: "Excavator hydraulic", q: "এক্সকাভেটর হাইড্রলিক সমস্যা সমাধান" },
];

export default function TipsFeed({ language }: TipsFeedProps) {
  const bn = language === "bn";
  const [input, setInput] = useState("");
  const [items, setItems] = useState<TipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const reqId = useRef(0);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 2) return;
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
        setItems(Array.isArray(data?.items) ? (data.items as TipItem[]) : []);
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
    runSearch(input);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div
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

        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CHIPS.map((c) => (
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
        <p className="px-4 py-6 text-center text-sm font-semibold text-white/70">
          {bn ? "ভিডিও খোঁজা হচ্ছে..." : "Searching videos..."}
        </p>
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
              <div key={v.id} className="rounded-2xl overflow-hidden bg-white/10">
                <div className="relative w-full aspect-video bg-black">
                  {playing ? (
                    <iframe
                      className="absolute inset-0 h-full w-full border-0"
                      src={`https://www.youtube.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(origin)}`}
                      title={v.title}
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlayingId(v.id)}
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
                  <h3 className="text-sm font-extrabold leading-snug line-clamp-2">{v.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-white/60 line-clamp-1">{v.channel}</p>
                  {playing && (
                    <a
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs font-bold text-white underline"
                    >
                      {bn ? "চলছে না? YouTube-এ খুলুন" : "Not playing? Open on YouTube"}
                    </a>
                  )}
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
