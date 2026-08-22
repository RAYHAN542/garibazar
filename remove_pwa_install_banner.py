#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Removes the old Chrome PWA "Install" banner shown on the Market page
(the amber-bordered card with the app icon and "Install"/"Later" buttons
that used the browser's native beforeinstallprompt). The Profile tab now
has a direct APK download banner instead, so this one is no longer needed.

Run from the project root (the folder containing `src/`):
    python3 remove_pwa_install_banner.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "components" / "MarketplaceTab.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''                {/* 📲 PWA Install Prompt Banner — লগইন/রেজিস্টার করলে চিরতরে বন্ধ হয়ে যায় */}
                {showInstallPrompt && (
                  <div className="mb-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                      <img
                        src="/icon-192.png"
                        alt="Gari Bazar"
                        className="w-14 h-14 rounded-2xl shadow-md shrink-0 object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                          {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                          {language === "bn"
                            ? "অ্যাপটি হোমস্ক্রিনে ইনস্টল করুন"
                            : "Install this app on your home screen"}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      {language === "bn"
                        ? "দ্রুত লোড হবে এবং নোটিফিকেশন সরাসরি \\"গাড়ি বাজার\\" অ্যাপের নামে আসবে, Chrome থেকে না।"
                        : "Faster loading and notifications will come from the app itself, not Chrome."}
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => dismissInstallPrompt(false)}
                        className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-2.5 rounded-lg transition cursor-pointer"
                      >
                        {language === "bn" ? "পরে করুন" : "Later"}
                      </button>
                      <button
                        type="button"
                        onClick={handleInstallApp}
                        className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm active:scale-95"
                      >
                        {language === "bn" ? "ইনস্টল করুন" : "Install"}
                      </button>
                    </div>
                  </div>
                )}


                {/* 🛠️ Modern Filters & Dynamic Sorting Panel (Revealed dynamically!) */}'''

NEW = '''                {/* 🛠️ Modern Filters & Dynamic Sorting Panel (Revealed dynamically!) */}'''


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))

    if nfc(OLD) not in text:
        print("[WARN] expected block not found - may already be patched, skipping")
        return

    text = text.replace(nfc(OLD), nfc(NEW), 1)
    TARGET.write_text(text, encoding="utf-8")
    print("[OK] MarketplaceTab.tsx: patched (Chrome PWA install banner removed)")


if __name__ == "__main__":
    main()
