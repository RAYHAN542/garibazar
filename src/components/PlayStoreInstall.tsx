import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isAndroidWeb, playStoreUrl } from "../utils/playStore";

const SNOOZE_KEY = "gb_play_popup_until";
const DAY = 86400000;

// Google Play-style "app listing" look: real app icon, app name, green install
// button. Tapping it opens the real Google Play page (the install itself
// happens there, not inside the website).
function PlayMark({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#01875f" d="M4 2.5v19l17-9.5z" />
    </svg>
  );
}

export function PlayStoreStrip({ language }: { language: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(isAndroidWeb());
  }, []);
  if (!show) return null;
  const bn = language === "bn";
  return (
    <a
      href={playStoreUrl("banner_strip")}
      className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
    >
      <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-extrabold leading-tight text-slate-900 dark:text-white">
          {bn ? "গাড়ি বাজার" : "Gari Bazar"}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
          <PlayMark size={11} />
          {bn ? "Google Play থেকে ফ্রি" : "Free on Google Play"}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#01875f] px-4 py-2 text-[13px] font-extrabold text-white">
        {bn ? "ইনস্টল" : "Install"}
      </span>
    </a>
  );
}

export function PlayStorePopup({ language }: { language: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAndroidWeb()) return;
    let until = 0;
    try {
      until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    } catch {
      /* ignore */
    }
    if (Date.now() < until) return;
    const t = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const snooze = (days: number) => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * DAY));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;
  const bn = language === "bn";
  return createPortal(
    <div className="fixed inset-x-0 bottom-24 z-[60] px-3">
      <div className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => snooze(7)}
          aria-label="close"
          className="absolute right-3 top-3 text-slate-400"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 pr-7">
          <img src="/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm" />
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight text-slate-900 dark:text-white">
              {bn ? "গাড়ি বাজার" : "Gari Bazar"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {bn ? "পার্টস ও গাড়ি বেচাকেনা" : "Buy & sell cars and parts"}
            </p>
          </div>
        </div>
        <a
          href={playStoreUrl("popup")}
          onClick={() => snooze(90)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#01875f] py-3 text-sm font-extrabold text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M4 2.5v19l17-9.5z" />
          </svg>
          {bn ? "Google Play থেকে ইনস্টল করুন" : "Install from Google Play"}
        </a>
        <button
          type="button"
          onClick={() => snooze(7)}
          className="mt-1 w-full py-2 text-center text-sm font-bold text-slate-500 dark:text-slate-400"
        >
          {bn ? "পরে" : "Later"}
        </button>
      </div>
    </div>,
    document.body
  );
}
