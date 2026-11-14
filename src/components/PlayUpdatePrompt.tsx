import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";

// Google Play-র নিজস্ব "in-app update": Play-তে নতুন ভার্সন থাকলে অ্যাপ খুললে
// জানায়, ইউজার চাপলে Play-ই ডাউনলোড/ইনস্টল করে (সরাসরি APK লিংক না -- Play
// নীতিসম্মত)। শুধু Play থেকে ইনস্টল করা Android অ্যাপে কাজ করে; ওয়েবে ও
// sideload APK-তে কিছু দেখায় না। এই কোড শুধু নতুন বিল্ড থেকে আছে -- পুরনো
// ভার্সনের ইউজাররা প্রথমবার Play-র সাধারণ অটো-আপডেটেই পাবে।
type Phase = "hidden" | "available" | "downloading" | "ready";
type Mode = "flexible" | "immediate" | "store";

export default function PlayUpdatePrompt() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [mode, setMode] = useState<Mode>("flexible");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | null = null;
    // অ্যাপ চালু ও প্রথম paint-কে বাধা না দিতে একটু পরে চেক
    const timer = setTimeout(async () => {
      try {
        const { AppUpdate, AppUpdateAvailability } = await import("@capawesome/capacitor-app-update");
        const info = await AppUpdate.getAppUpdateInfo();
        if (cancelled) return;
        if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return;
        setMode(info.flexibleUpdateAllowed ? "flexible" : info.immediateUpdateAllowed ? "immediate" : "store");
        handle = await AppUpdate.addListener("onFlexibleUpdateStateChange", (state: any) => {
          // Play InstallStatus.DOWNLOADED = 11
          if (state && state.installStatus === 11) setPhase("ready");
        });
        setPhase("available");
      } catch {
        // non-critical: ব্যর্থ হলে চুপচাপ থেমে যাবে
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (handle) void handle.remove();
    };
  }, []);

  const startUpdate = async () => {
    try {
      const { AppUpdate } = await import("@capawesome/capacitor-app-update");
      if (mode === "flexible") {
        setPhase("downloading");
        await AppUpdate.startFlexibleUpdate();
      } else if (mode === "immediate") {
        await AppUpdate.performImmediateUpdate();
      } else {
        await AppUpdate.openAppStore();
      }
    } catch {
      setPhase("available");
    }
  };

  const restart = async () => {
    try {
      const { AppUpdate } = await import("@capawesome/capacitor-app-update");
      await AppUpdate.completeFlexibleUpdate();
    } catch {
      // ব্যর্থ হলে ইউজার নিজে অ্যাপ বন্ধ করে খুললেও আপডেট বসে যায়
    }
  };

  if (phase === "hidden" || (dismissed && phase !== "ready")) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-6">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl">
        {phase !== "ready" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="বন্ধ করুন"
            className="absolute top-3 right-3 p-1 text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-slate-950">
          <Download className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          {phase === "ready" ? "আপডেট প্রস্তুত!" : "নতুন আপডেট এসেছে!"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {phase === "available" && "আরও ভালো ফিচার, দ্রুত গতি ও নিরাপত্তার জন্য এখনই GariBazar আপডেট করুন।"}
          {phase === "downloading" && "আপডেট ডাউনলোড হচ্ছে, একটু অপেক্ষা করুন..."}
          {phase === "ready" && "ডাউনলোড শেষ। অ্যাপ রিস্টার্ট করলেই নতুন সংস্করণ চালু হবে।"}
        </p>
        {phase === "available" && (
          <button
            type="button"
            onClick={startUpdate}
            className="mt-5 w-full rounded-full bg-amber-500 py-3 text-base font-extrabold text-slate-950 cursor-pointer"
          >
            এখনই আপডেট করুন
          </button>
        )}
        {phase === "downloading" && (
          <div className="mt-5 w-full rounded-full bg-amber-500/60 py-3 text-base font-extrabold text-slate-950">
            ডাউনলোড হচ্ছে...
          </div>
        )}
        {phase === "ready" && (
          <button
            type="button"
            onClick={restart}
            className="mt-5 w-full rounded-full bg-amber-500 py-3 text-base font-extrabold text-slate-950 cursor-pointer"
          >
            রিস্টার্ট করুন
          </button>
        )}
        {phase === "available" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 text-sm font-semibold text-slate-500 cursor-pointer"
          >
            পরে করব
          </button>
        )}
      </div>
    </div>
  );
}
