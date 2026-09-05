import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Download, X } from "lucide-react";
import { SupportedLanguage } from "../types";

// Local-bundle মোডে (capacitor.config.ts-এ server.url নেই) অ্যাপের HTML/JS
// আর ওয়েবসাইটের নতুন ডিপ্লয়ের সাথে সাথে অটো আপডেট হয় না -- নতুন ফিচার/ফিক্স
// পেতে ইউজারকে নতুন APK ইনস্টল করতে হয়। এই ব্যানারটা Firestore-এর
// app_config/version ডকুমেন্ট চেক করে জানায় নতুন ভার্সন থাকলে।
//
// ⚠️ Play Store পলিসি (audit A3): সরাসরি APK ডাউনলোড লিংক দেখানো
// "Device and Network Abuse" পলিসি ভাঙে -- Play নিজে থেকে সব ইউজারকে আপডেট
// করে দেয়, তাই Play-বাউন্ড বিল্ডে এই ব্যানার লাগবেই না। যতদিন sideload/
// internal-testing APK দিয়ে চলছেন ততদিন এটা চালু রাখা নিরাপদ ও দরকারি;
// Play submission-এর জন্য চূড়ান্ত বিল্ড বানানোর সময় GitHub Actions-এর env-এ
// VITE_PLAY_STORE_BUILD=true যোগ করে দিলেই এই ব্যানার সেই বিল্ডে বন্ধ হয়ে
// যাবে -- কোড পাল্টানোর দরকার নেই।
const IS_PLAY_STORE_BUILD = import.meta.env.VITE_PLAY_STORE_BUILD === "true";
//
// ম্যানুয়াল সেটআপ (একবারই করতে হবে): Firestore Console-এ গিয়ে
//   app_config/version  ডকুমেন্ট তৈরি করো, ফিল্ড:
//     latestVersionCode  (number)  -- android/app/build.gradle-এর versionCode-এর সাথে মিলিয়ে
//     apkUrl             (string)  -- নতুন APK-এর ডাউনলোড লিংক
//   নতুন APK রিলিজ দিলেই এই ডকুমেন্টের latestVersionCode আপডেট করে দিও।
interface UpdateBannerProps {
  language: SupportedLanguage;
}

export default function UpdateBanner({ language }: UpdateBannerProps) {
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // ওয়েবে (Vercel-এ) এই চেক পুরোপুরি অর্থহীন -- ওয়েব সবসময়ই সর্বশেষ কোড
    // পায় deploy-এর সাথে সাথে। এটা শুধু native APK-এর জন্য প্রাসঙ্গিক।
    if (!Capacitor.isNativePlatform()) return;

    // Play Store বিল্ডে সরাসরি APK ডাউনলোড অফার করা পলিসি ভায়োলেশন --
    // Play নিজেই আপডেট ডেলিভার করে, তাই এখানেই থেমে যাওয়া (audit A3)।
    if (IS_PLAY_STORE_BUILD) return;

    // splash হাইড বা প্রথম paint-কে ব্লক না করার জন্য এই effect আলাদা এবং
    // fire-and-forget -- ব্যর্থ হলেও চুপচাপ কিছু না দেখিয়ে থেমে যায়।
    (async () => {
      try {
        const [{ App: CapacitorApp }, versionSnap] = await Promise.all([
          import("@capacitor/app"),
          getDoc(doc(db, "app_config", "version")),
        ]);

        if (!versionSnap.exists()) return;
        const data = versionSnap.data() as { latestVersionCode?: number; apkUrl?: string };
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
