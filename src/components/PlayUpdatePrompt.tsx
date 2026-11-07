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
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md">
      <div className="flex items-center gap-2 min-w-0">
        <Download className="w-4 h-4 shrink-0" />
        <span className="truncate font-semibold">
          {phase === "available" && "নতুন ভার্সন এসেছে — আপডেট করুন"}
          {phase === "downloading" && "আপডেট ডাউনলোড হচ্ছে..."}
          {phase === "ready" && "আপডেট ডাউনলোড হয়েছে — রিস্টার্ট করুন"}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {phase === "available" && (
          <button type="button" onClick={startUpdate} className="underline font-bold">
            আপডেট
          </button>
        )}
        {phase === "ready" && (
          <button type="button" onClick={restart} className="underline font-bold">
            রিস্টার্ট
          </button>
        )}
        {phase !== "ready" && (
          <button type="button" onClick={() => setDismissed(true)} aria-label="বন্ধ করুন">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
