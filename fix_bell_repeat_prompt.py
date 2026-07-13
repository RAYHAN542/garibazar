#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix: clicking the 🔔 bell button (next to the search bar) always re-showed
the "Never Miss Car Parts Deals! / Enable push alerts" banner, even after
the user had already clicked Enable and granted permission. The button's
onClick unconditionally called setShowNotificationPrompt(true) without
checking the current notificationPermission state.

Now it only opens that "please enable" banner if permission isn't already
granted. If it's already granted, tapping the bell shows a quick
confirmation instead of nagging the user again. If it was denied at the
OS/browser level, it lets the user know they'll need to allow it from
browser/site settings.

Run from the project root (the folder containing `src/`):
    python3 fix_bell_repeat_prompt.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "App.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''                    {/* মোবাইলে হেডার বাদ দেওয়ার পর, 🔔 নোটিফিকেশন বাটন সার্চ বারের পাশে বসানো হলো */}
                    <button
                      type="button"
                      onClick={() => setShowNotificationPrompt(true)}
                      className="md:hidden relative p-3 w-11 h-11 rounded-2xl border bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                      title={language === "bn" ? "নোটিফিকেশন" : "Notifications"}
                    >'''

NEW = '''                    {/* মোবাইলে হেডার বাদ দেওয়ার পর, 🔔 নোটিফিকেশন বাটন সার্চ বারের পাশে বসানো হলো */}
                    <button
                      type="button"
                      onClick={() => {
                        if (notificationPermission === "granted") {
                          alert(language === "bn" ? "নোটিফিকেশন ইতিমধ্যে চালু আছে ✅" : "Notifications are already enabled ✅");
                        } else if (notificationPermission === "denied") {
                          alert(language === "bn" ? "নোটিফিকেশন বন্ধ করা আছে। ব্রাউজার/সাইট সেটিংস থেকে চালু করুন।" : "Notifications are blocked. Please allow them from your browser/site settings.");
                        } else {
                          setShowNotificationPrompt(true);
                        }
                      }}
                      className="md:hidden relative p-3 w-11 h-11 rounded-2xl border bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                      title={language === "bn" ? "নোটিফিকেশন" : "Notifications"}
                    >'''


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))

    if nfc(OLD) not in text:
        print("[WARN] expected snippet not found - file may already be patched, skipping")
        return

    text = text.replace(nfc(OLD), nfc(NEW), 1)
    TARGET.write_text(text, encoding="utf-8")
    print("[OK] App.tsx: patched (bell button no longer re-nags after notifications are already enabled)")


if __name__ == "__main__":
    main()
