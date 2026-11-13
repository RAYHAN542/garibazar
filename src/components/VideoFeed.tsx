import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Volume2, VolumeX, Play, MapPin, Plus, Phone, Bookmark, Share2, MessageCircle, Eye } from "lucide-react";
import type { PartListing, SupportedLanguage } from "../types";
import { AddPartForm } from "./AddPartForm";
import TipsFeed from "./TipsFeed";
import { supabase } from "../supabase";
import { nativeFetch } from "../utils/nativeFetch";
import { apiUrl } from "../utils/apiBase";
import { trackListingClick, incrementListingView } from "../utils/counters";
import { isNativeAdsSupported } from "../utils/nativeAds";
import { useVideoInterstitial } from "../hooks/useVideoInterstitial";
import { mixFeed, trackInterest } from "../utils/feedRanker";

const viewedThisSession = new Set<string>();

// ------------------------------------------------------------------------
// YouTube Shorts-style full-screen vertical video feed.
// Swipe up/down to move between listing videos; the visible one autoplays
// (muted until the user taps the speaker), tap the video to pause/resume.
// Only the current video and its two neighbours load their file, so scrolling
// does not burn the user's mobile data.
//
// The "ভিডিও যোগ করুন" button at the top opens a separate video-post form
// (AddPartForm in mode="video"), so the normal photo "sell" form stays as is.
//
// 🔧 (youtube-tips) Two tabs at the top: "ভিডিও" (the seller videos above,
// unchanged) and "টিপস" (TipsFeed: YouTube search for car-repair how-to
// videos). Each seller video now fills the whole screen -- before, two
// half-height videos were on screen at once, which made scrolling stutter on
// phones. Also only the current + next + previous video are loaded now.
// ------------------------------------------------------------------------

interface VideoFeedProps {
  language: SupportedLanguage;
  videos: PartListing[];
  currentUser: any;
  onLoginPrompt: () => void;
  onClose: () => void;
  onSelect: (listing: PartListing) => void;
  isAdmin?: boolean;
  onPosted?: () => void;
  onStartChat: (listing: PartListing) => void;
}

const formatPrice = (price: number, language: SupportedLanguage): string => {
  if (!price || price <= 0) {
    return language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Contact for price";
  }
  return "৳" + price.toLocaleString(language === "bn" ? "bn-BD" : "en-US");
};

interface VideoSlideProps {
  listing: PartListing;
  index: number;
  rel: number;
  muted: boolean;
  adPlaying: boolean;
  language: SupportedLanguage;
  onToggleMute: () => void;
  onForceMute: () => void;
  onSelect: (listing: PartListing) => void;
  currentUser: any;
  onLoginPrompt: () => void;
  isAdmin: boolean;
  onStartChat: (listing: PartListing) => void;
  onClose: () => void;
}

function VideoSlideImpl({ listing, index, rel, muted, adPlaying, language, onToggleMute, onForceMute, currentUser, onLoginPrompt, isAdmin, onStartChat, onClose }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const isActive = rel === 0;
  // 🔧 (youtube-tips) was rel -1..2 (4 videos loaded at once); now previous, current, next only.
  const isNear = rel >= -1 && rel <= 1;
  const [expanded, setExpanded] = useState(false);
  const [, setCounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    try {
      const f = JSON.parse(localStorage.getItem("gari_bazar_favorites") || "[]");
      setSaved(Array.isArray(f) && f.includes(listing.id));
    } catch (_) {}
  }, [listing.id]);

  const toggleSave = () => {
    try {
      let favs = JSON.parse(localStorage.getItem("gari_bazar_favorites") || "[]");
      if (!Array.isArray(favs)) favs = [];
      let next: string[];
      if (favs.includes(listing.id)) {
        next = favs.filter((id: string) => id !== listing.id);
        setSaved(false);
      } else {
        next = [...favs, listing.id];
        setSaved(true);
        trackInterest(listing, 2);
      }
      localStorage.setItem("gari_bazar_favorites", JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
    } catch (_) {}
  };

  const handleShare = async () => {
    const shareUrl = `https://garibazar.shop/1/${listing.id}`;
    const shareText = language === "bn" ? `গাড়ি বাজারে দেখুন: ${listing.title}` : `Check this out on Gari Bazar: ${listing.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: shareText, url: shareUrl });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (_) {}
  };

  const handleChat = () => {
    if (!currentUser?.uid) { onLoginPrompt(); return; }
    trackInterest(listing, 3);
    onClose();
    onStartChat(listing);
  };

  useEffect(() => {
    if (isActive && !viewedThisSession.has(listing.id)) {
      viewedThisSession.add(listing.id);
      setCounted(true);
      incrementListingView(listing.id);
    }
  }, [isActive, listing.id]);

  // 🎯 ভিডিও ৩ সেকেন্ড বা বেশি দেখলে পছন্দের ইতিহাসে জমা হয় (দ্রুত স্ক্রল করে পেরিয়ে গেলে গোনা হয় না)।
  // এই ইতিহাস দিয়েই ফিড নতুন + পছন্দের + পুরনো মিলিয়ে সাজানো হয় (utils/feedRanker.ts)।
  useEffect(() => {
    if (!isActive || adPlaying) return;
    const t = setTimeout(() => { trackInterest(listing, 1); }, 3000);
    return () => clearTimeout(t);
  }, [isActive, adPlaying, listing.id]);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  useEffect(() => {
    if (!isActive) setExpanded(false);
  }, [isActive]);

  const revealPhone = async () => {
    if (!currentUser?.uid) { onLoginPrompt(); return; }
    setPhoneLoading(true);
    setPhoneError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("no session");
      const resp = await nativeFetch(apiUrl("/api/get-seller-contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "failed");
      setPhone((data.contactNumber as string) || null);
      trackInterest(listing, 3);
      try { await trackListingClick(listing.id); } catch (_) {}
    } catch (_) {
      setPhoneError(true);
    } finally {
      setPhoneLoading(false);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      if (adPlaying) {
        v.pause();
      } else {
        v.play().then(() => setPaused(false)).catch(() => {
          // সাউন্ডসহ অটোপ্লে আটকালে মিউট করে আবার চালাই (ব্যবহারকারী স্পিকারে চাপলে সাউন্ড আসবে)
          if (!v.muted) {
            v.muted = true;
            onForceMute();
            v.play().then(() => setPaused(false)).catch(() => setPaused(true));
          } else {
            setPaused(true);
          }
        });
      }
    } else {
      v.pause();
      if (!isNear) { try { v.currentTime = 0; } catch (_) {} }
      setPaused(false);
    }
  }, [isActive, isNear, adPlaying]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPaused(false)).catch(() => {});
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <div
      data-index={index}
      className="h-full w-full snap-start snap-always relative bg-black flex items-center justify-center overflow-hidden"
    >
      {isNear && listing.videoUrl ? (
        <video
          ref={videoRef}
          src={listing.videoUrl + "#t=0.1"}
          poster={listing.image || undefined}
          className="h-full w-full object-cover [transform:translateZ(0)]"
          loop
          playsInline
          muted={muted}
          preload={rel === 0 || rel === 1 ? "auto" : "metadata"}
          onClick={togglePause}
        />
      ) : listing.image ? (
        <img src={listing.image} alt="" className="h-full w-full object-cover opacity-60" />
      ) : null}

      {paused && isActive && (
        <button
          type="button"
          onClick={togglePause}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/55 flex items-center justify-center text-white"
        >
          <Play className="w-8 h-8 fill-white" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        className="absolute right-2 bottom-[6.5rem] z-10 w-9 h-9 rounded-full bg-black/55 flex items-center justify-center text-white cursor-pointer"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="fixed inset-0 z-[95] flex items-end bg-black/60" onClick={() => setExpanded(false)}>
          <div
            className="w-full max-h-[75%] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold leading-snug">{listing.title}</h3>
              <button type="button" aria-label="Close" onClick={() => setExpanded(false)} className="p-1 rounded-full bg-slate-200 dark:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1 text-xl font-black text-amber-500">{formatPrice(listing.price, language)}</p>
            {listing.location && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{listing.location}</span>
              </p>
            )}
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{listing.description}</p>
            {listing.sellerName && (
              <p className="mt-3 text-xs font-bold text-slate-500">
                {language === "bn" ? "বিক্রেতা: " : "Seller: "}{listing.sellerName}
              </p>
            )}
            <div className="mt-4">
              {phone ? (
                <a href={`tel:${phone}`} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-black text-white">
                  <Phone className="w-4 h-4" />
                  {phone}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={revealPhone}
                  disabled={phoneLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-black text-slate-950 cursor-pointer disabled:opacity-60"
                >
                  <Phone className="w-4 h-4" />
                  {phoneLoading ? "..." : language === "bn" ? "নম্বর দেখুন" : "Show number"}
                </button>
              )}
              {phoneError && (
                <p className="mt-2 text-xs font-semibold text-red-500">
                  {language === "bn" ? "নম্বর আনা যায়নি, আবার চেষ্টা করুন" : "Could not load the number, try again"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="absolute right-2 top-2 z-10 flex flex-col items-center gap-1.5">
        <button type="button" aria-label="Save" onClick={toggleSave} className="flex flex-col items-center gap-1 text-white cursor-pointer">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
            <Bookmark className={`w-5 h-5 ${saved ? "fill-amber-400 text-amber-400" : ""}`} />
          </span>
          <span className="text-[9px] font-bold drop-shadow leading-none">{saved ? (language === "bn" ? "সেভড" : "Saved") : (language === "bn" ? "সেভ" : "Save")}</span>
        </button>
        <button type="button" aria-label="Share" onClick={handleShare} className="flex flex-col items-center gap-1 text-white cursor-pointer">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
            <Share2 className="w-5 h-5" />
          </span>
          <span className="text-[9px] font-bold drop-shadow leading-none">{shareCopied ? (language === "bn" ? "কপি হয়েছে" : "Copied") : (language === "bn" ? "শেয়ার" : "Share")}</span>
        </button>
        <button type="button" aria-label="Chat" onClick={handleChat} className="flex flex-col items-center gap-1 text-white cursor-pointer">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
            <MessageCircle className="w-5 h-5" />
          </span>
          <span className="text-[9px] font-bold drop-shadow leading-none">{language === "bn" ? "চ্যাট" : "Chat"}</span>
        </button>
        {isAdmin && (
          <div className="pointer-events-none flex flex-col items-center gap-1 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45">
              <Eye className="w-5 h-5" />
            </span>
            <span className="text-[9px] font-bold drop-shadow leading-none">{(listing.views || 0) + (viewedThisSession.has(listing.id) ? 1 : 0)}</span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-0 inset-x-0 px-3 pt-10 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white">
        <h3 className="text-sm font-extrabold leading-snug line-clamp-1">{listing.title}</h3>
        <p className="text-base font-black text-amber-400">{formatPrice(listing.price, language)}</p>
        {listing.location && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-white/80">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="pointer-events-auto mt-1.5 w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer"
        >
          {language === "bn" ? "বিস্তারিত দেখুন" : "View details"}
        </button>
      </div>
    </div>
  );
}

const VideoSlide = memo(VideoSlideImpl);

export default function VideoFeed({ language, videos, currentUser, onLoginPrompt, onClose, onSelect, isAdmin, onStartChat, onPosted }: VideoFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const forceMute = useCallback(() => setMuted(true), []);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  // 🔧 (youtube-tips) "sale" = seller videos (as before), "tips" = YouTube mechanic tips.
  const [tab, setTab] = useState<"sale" | "tips">("sale");
  const containerRef = useRef<HTMLDivElement>(null);
  const jumpPending = useRef(false);
  const firstIdAtPost = useRef<string | null>(null);
  // 🎯 ভিডিও ফিডও মিশ্র: নতুন + পছন্দের + পুরনো (ইতিহাস না থাকলে আগের মতোই নতুন থেকে পুরনো)।
  // তালিকা বদলালেই (নতুন ভিডিও লোড/পোস্ট) শুধু নতুন করে সাজে, ভিডিও দেখার সময় ক্রম লাফায় না।
  const ordered = useMemo(() => mixFeed(videos), [videos]);
  // প্রতি ৪টা ভিডিও swipe-এর পর Interstitial (video) ad; ad চলার সময় ভিডিও pause
  const adPlaying = useVideoInterstitial(activeIndex, isNativeAdsSupported());

  const switchTab = (next: "sale" | "tips") => {
    if (next === tab) return;
    setTab(next);
    // The seller-video list is re-created when coming back to it (starts at the top).
    setActiveIndex(0);
  };

  // The slide that is at least 60% visible becomes the active (playing) one.
  useEffect(() => {
    if (tab !== "sale") return;
    const root = containerRef.current;
    if (!root || videos.length === 0) return;
    const visible = new Set<number>();
    let timer: any = null;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(idx)) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) visible.add(idx); else visible.delete(idx);
        });
        if (visible.size > 0) {
          const next = Math.min(...Array.from(visible));
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => setActiveIndex(next), 140);
        }
      },
      { root, threshold: [0.6] }
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => { if (timer) clearTimeout(timer); observer.disconnect(); };
  }, [videos.length, tab]);

  // পোস্টের পর নতুন ভিডিও তালিকার মাথায় এলে সেখানে নিয়ে যাই।
  useEffect(() => {
    if (!jumpPending.current) return;
    if (videos[0]?.id === firstIdAtPost.current) return;
    jumpPending.current = false;
    requestAnimationFrame(() => {
      try { containerRef.current?.scrollTo({ top: 0 }); } catch (_) {}
      setActiveIndex(0);
    });
  }, [videos]);

  // Stop the page behind the feed from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overscrollBehaviorY;
    const prevBody = document.body.style.overscrollBehaviorY;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overscrollBehaviorY = prevHtml;
      document.body.style.overscrollBehaviorY = prevBody;
    };
  }, []);

  useEffect(() => {
    if (!posted) return;
    const t = setTimeout(() => setPosted(false), 3500);
    return () => clearTimeout(t);
  }, [posted]);

  const tabBtn = (id: "sale" | "tips", label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => switchTab(id)}
      className={`h-8 px-3 rounded-full text-sm font-black cursor-pointer whitespace-nowrap ${
        tab === id ? "bg-white text-black" : "bg-white/15 text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div data-no-ptr className="fixed inset-0 z-[80] bg-black overscroll-none">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-1.5">
          {tabBtn("sale", language === "bn" ? "ভিডিও" : "Videos")}
          {tabBtn("tips", language === "bn" ? "টিপস" : "Tips")}
        </div>
        <div className="flex items-center gap-2">
          {tab === "sale" && (
            <button
              type="button"
              onClick={() => setIsPostOpen(true)}
              className="h-9 px-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span className="whitespace-nowrap">{language === "bn" ? "ভিডিও যোগ করুন" : "Add Video"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {posted && (
        <div className="absolute top-[calc(4rem+env(safe-area-inset-top))] inset-x-0 z-20 flex justify-center pointer-events-none">
          <span className="px-4 py-2 rounded-full bg-green-600 text-white text-xs font-bold shadow-lg">
            {language === "bn" ? "ভিডিও পোস্ট হয়েছে ✅" : "Video posted ✅"}
          </span>
        </div>
      )}

      {tab === "tips" ? (
        <TipsFeed language={language} />
      ) : ordered.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center px-8 text-center text-white">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Play className="w-8 h-8 fill-white" />
          </div>
          <p className="text-base font-extrabold">
            {language === "bn" ? "এখনো কোনো ভিডিও নেই" : "No videos yet"}
          </p>
          <p className="mt-1 text-sm text-white/70 font-semibold">
            {language === "bn" ? "সেলাররা ভিডিও যোগ করলে এখানে দেখতে পাবেন।" : "Videos added by sellers will show up here."}
          </p>
        </div>
      ) : (
        <div ref={containerRef} style={{ overflowAnchor: "none", paddingTop: "calc(3.5rem + env(safe-area-inset-top))", scrollPaddingTop: "calc(3.5rem + env(safe-area-inset-top))" }} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-contain">
          {ordered.map((listing, index) => (
            <VideoSlide
              key={listing.id}
              listing={listing}
              index={index}
              rel={Math.max(-2, Math.min(3, index - activeIndex))}
              muted={muted}
              adPlaying={adPlaying}
              language={language}
              onToggleMute={toggleMute}
              onForceMute={forceMute}
              currentUser={currentUser}
              onLoginPrompt={onLoginPrompt}
              isAdmin={!!isAdmin}
              onStartChat={onStartChat}
              onClose={onClose}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {isPostOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-100 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 bg-white border-b border-slate-200">
            <span className="text-sm font-black text-slate-800">
              {language === "bn" ? "ভিডিও পোস্ট করুন" : "Post a Video"}
            </span>
            <button
              type="button"
              onClick={() => setIsPostOpen(false)}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3 pb-10">
            <AddPartForm
              mode="video"
              language={language}
              currentUser={currentUser}
              onPostSuccess={() => { setIsPostOpen(false); setPosted(true); jumpPending.current = true; firstIdAtPost.current = videos[0]?.id ?? null; setTimeout(() => { jumpPending.current = false; }, 15000); onPosted?.(); try { containerRef.current?.scrollTo({ top: 0 }); } catch (_) {} setActiveIndex(0); }}
              onLoginPrompt={() => { setIsPostOpen(false); onClose(); onLoginPrompt(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
