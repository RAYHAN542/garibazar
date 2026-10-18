import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Smartphone, X } from "lucide-react";
import { isAndroidWeb, playStoreUrl } from "../utils/playStore";

const SNOOZE_KEY = "gb_play_popup_until";
const DAY = 86400000;

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
      className="mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-3.5 text-white shadow-sm active:scale-[0.98]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight">
          {bn ? "গাড়ি বাজার অ্যাপ ইনস্টল করুন" : "Install Gari Bazar App"}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/80">
          {bn ? "Google Play থেকে ফ্রি ইনস্টল করুন" : "Free on Google Play"}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-orange-600">
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
          <X className="h-4 w-4" />
        </button>
        <p className="pr-6 text-base font-extrabold text-slate-900 dark:text-white">
          {bn ? "গাড়ি বাজার অ্যাপ ইনস্টল করুন" : "Install the Gari Bazar app"}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {bn
            ? "দ্রুত লোড, নোটিফিকেশন আর সহজে বেচাকেনা — Google Play থেকে ফ্রি"
            : "Faster, with notifications — free on Google Play"}
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href={playStoreUrl("popup")}
            onClick={() => snooze(90)}
            className="flex-1 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 py-3 text-center text-sm font-extrabold text-white"
          >
            {bn ? "Google Play-তে ইনস্টল করুন" : "Install on Google Play"}
          </a>
          <button
            type="button"
            onClick={() => snooze(7)}
            className="rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 dark:text-slate-400"
          >
            {bn ? "পরে" : "Later"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
