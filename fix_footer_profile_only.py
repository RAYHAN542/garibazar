#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix: the "Gari Bazar Auto Parts Marketplace" footer (with the description
paragraph and "Legal Policies & Privacy Hub" link) was showing on every
tab (Market, Sell, Dashboard, Chat, Profile) instead of only the Profile
page. It's rendered right after </main>, outside any tab condition, so it
always displays regardless of which tab is active.

This wraps it in `{activeTab === 'profile' && (...)}` so it only shows on
the Profile tab again.

Run from the project root (the folder containing `src/`):
    python3 fix_footer_profile_only.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "App.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''      {/* 5. Footer with credit/disclaimers */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-8 pb-28 md:pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-slate-300 font-bold">
            <Car className="w-4 h-4 text-amber-500" />
            <span>{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-400">
            {language === "bn" 
              ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
              : "Bangladesh's premium online car parts marketplace. Boost your listings with secure, real-time sponsored ad placements."}
          </p>
          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
            <span>© 2026 Gari Bazar Tech</span>
            <span>•</span>
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
            >
              {language === "bn" ? "🔒 আইনি পলিসি ও প্রাইভেসি কেন্দ্র" : "🔒 Legal Policies & Privacy Hub"}
            </button>
          </div>
        </div>
      </footer>'''

NEW = '''      {/* 5. Footer with credit/disclaimers - Profile tab only */}
      {activeTab === 'profile' && (
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-8 pb-28 md:pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-slate-300 font-bold">
            <Car className="w-4 h-4 text-amber-500" />
            <span>{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-400">
            {language === "bn" 
              ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
              : "Bangladesh's premium online car parts marketplace. Boost your listings with secure, real-time sponsored ad placements."}
          </p>
          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
            <span>© 2026 Gari Bazar Tech</span>
            <span>•</span>
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
            >
              {language === "bn" ? "🔒 আইনি পলিসি ও প্রাইভেসি কেন্দ্র" : "🔒 Legal Policies & Privacy Hub"}
            </button>
          </div>
        </div>
      </footer>
      )}'''


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))

    if nfc(OLD) not in text:
        print("[WARN] expected footer block not found - may already be patched, skipping")
        return

    text = text.replace(nfc(OLD), nfc(NEW), 1)
    TARGET.write_text(text, encoding="utf-8")
    print("[OK] App.tsx: patched (footer now only renders on Profile tab)")


if __name__ == "__main__":
    main()
