import { useEffect, useRef, useState } from "react";
import { X, Volume2, VolumeX, Play, MapPin, Plus } from "lucide-react";
import type { PartListing, SupportedLanguage } from "../types";
import { AddPartForm } from "./AddPartForm";

// ------------------------------------------------------------------------
// YouTube Shorts-style full-screen vertical video feed.
// Swipe up/down to move between listing videos; the visible one autoplays
// (muted until the user taps the speaker), tap the video to pause/resume.
// Only the current video and its two neighbours load their file, so scrolling
// does not burn the user's mobile data.
//
// The "ভিডিও যোগ করুন" button at the top opens a separate video-post form
// (AddPartForm in mode="video"), so the normal photo "sell" form stays as is.
// ------------------------------------------------------------------------

interface VideoFeedProps {
  language: SupportedLanguage;
  videos: PartListing[];
  currentUser: any;
  onLoginPrompt: () => void;
  onClose: () => void;
  onSelect: (listing: PartListing) => void;
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
  activeIndex: number;
  muted: boolean;
  language: SupportedLanguage;
  onToggleMute: () => void;
  onSelect: (listing: PartListing) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}

function VideoSlide({ listing, index, activeIndex, muted, language, onToggleMute, onSelect, registerRef }: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const isActive = index === activeIndex;
  const isNear = Math.abs(index - activeIndex) <= 1;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      v.pause();
      try { v.currentTime = 0; } catch (_) {}
      setPaused(false);
    }
  }, [isActive, isNear]);

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
      ref={registerRef}
      className="h-full w-full snap-start snap-always relative bg-black flex items-center justify-center overflow-hidden"
    >
      {isNear && listing.videoUrl ? (
        <video
          ref={videoRef}
          src={listing.videoUrl}
          poster={listing.image || undefined}
          className="h-full w-full object-contain"
          loop
          playsInline
          muted={muted}
          preload={isActive ? "auto" : "metadata"}
          onClick={togglePause}
        />
      ) : listing.image ? (
        <img src={listing.image} alt="" className="h-full w-full object-contain opacity-60" />
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
        className="absolute right-3 bottom-44 w-10 h-10 rounded-full bg-black/55 flex items-center justify-center text-white cursor-pointer"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      <div className="absolute bottom-0 inset-x-0 px-4 pt-16 pb-[calc(1.25rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white">
        <h3 className="text-base font-extrabold leading-snug line-clamp-2">{listing.title}</h3>
        <p className="mt-1 text-lg font-black text-amber-400">{formatPrice(listing.price, language)}</p>
        {listing.location && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-white/80">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => onSelect(listing)}
          className="mt-3 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm cursor-pointer"
        >
          {language === "bn" ? "বিস্তারিত দেখুন" : "View details"}
        </button>
      </div>
    </div>
  );
}

export default function VideoFeed({ language, videos, currentUser, onLoginPrompt, onClose, onSelect }: VideoFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // The slide that is at least 60% visible becomes the active (playing) one.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || videos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [videos.length]);

  // Stop the page behind the feed from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!posted) return;
    const t = setTimeout(() => setPosted(false), 3500);
    return () => clearTimeout(t);
  }, [posted]);

  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/70 to-transparent">
        <span className="text-white text-base font-black tracking-tight">
          {language === "bn" ? "গাড়ির ভিডিও" : "Car Videos"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPostOpen(true)}
            className="h-9 px-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">{language === "bn" ? "ভিডিও যোগ করুন" : "Add Video"}</span>
          </button>
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

      {videos.length === 0 ? (
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
        <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
          {videos.map((listing, index) => (
            <VideoSlide
              key={listing.id}
              listing={listing}
              index={index}
              activeIndex={activeIndex}
              muted={muted}
              language={language}
              onToggleMute={() => setMuted((m) => !m)}
              onSelect={onSelect}
              registerRef={(el) => { slideRefs.current[index] = el; }}
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
              onPostSuccess={() => { setIsPostOpen(false); setPosted(true); }}
              onLoginPrompt={() => { setIsPostOpen(false); onClose(); onLoginPrompt(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
