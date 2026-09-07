import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabase";
import { Download, X } from "lucide-react";
import { SupportedLanguage } from "../types";

// Local-bundle মোডে (capacitor.config.ts-এ server.url নেই) অ্যাপের HTML/JS
// আর ওয়েবসাইটের নতুন ডিপ্লয়ের সাথে সাথে অটো আপডেট হয় না -- নতুন ফিচার/ফিক্স
// পেতে ইউজারকে নতুন APK ইনস্টল করতে হয়। এই ব্যানারটা Supabase-এর
// app_config টেবিলে key='version' রো চেক করে জানায় নতুন ভার্সন থাকলে।
const IS_PLAY_STORE_BUILD = import.meta.env.VITE_PLAY_STORE_BUILD === "true";
//
// ম্যানুয়াল সেটআপ (একবারই করতে হবে): Supabase-এ app_config টেবিলে
//   key = "version", value = { "latestVersionCode": <number>, "apkUrl": "<string>" }
//   নতুন APK রিলিজ দিলেই এই রো-এর value আপডেট করে দিও।
interface UpdateBannerProps {
  language: SupportedLanguage;
}

export default function UpdateBanner({ language }: UpdateBannerProps) {
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (IS_PLAY_STORE_BUILD) return;

    (async () => {
      try {
        const [{ App: CapacitorApp }, { data: row }] = await Promise.all([
          import("@capacitor/app"),
          supabase.from("app_config").select("value").eq("key", "version").maybeSingle(),
        ]);

        if (!row?.value) return;
        const data = row.value as { latestVersionCode?: number; apkUrl?: string };
        if (!data.latestVersionCode || !data.apkUrl) return;

        const info = await CapacitorApp.getInfo();
        const installedBuild = parseInt(info.build, 10);
        if (Number.isNaN(installedBuild)) return;

        if (installedBuild < data.latestVersionCode) {
          setApkUrl(data.apkUrl);
        }
      } catch {
        // নীরবে থেমে যাওয়া -- এটা non-critical, মূল অ্যাপের কাজে বাধা দেওয়া উচিত না
      }
    })();
  }, []);

  if (!apkUrl || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <Download className="w-4 h-4 shrink-0" />
        <span className="truncate font-semibold">
          {language === "bn" ? "নতুন ভার্সন পাওয়া গেছে — আপডেট করুন" : "A new version is available — update now"}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href={apkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-bold"
        >
          {language === "bn" ? "ডাউনলোড" : "Download"}
        </a>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
