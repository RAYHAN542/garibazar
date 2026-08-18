#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: Profile পেজের দুটো জিনিস ঠিক করা হচ্ছে --
  1. উপরের "গ" লেখা গোল আইকনটা বদলে অ্যাপের আসল লোগো (icon-512.png) বসানো
  2. "Sign In / Register" বাটন এবং এই "গ" আইকনে ভুল Tailwind রঙের নাম
     (orange-550, orange-605, amber-550) ছিল -- Tailwind-এ এসব শেড আসলে
     নেই, তাই ওই অংশ transparent হয়ে পেছনের ডার্ক ব্যাকগ্রাউন্ড দেখা যাচ্ছিল
     ("ডান দিক হালকা ডার্ক" দেখানোর কারণ এটাই)। সঠিক শেড (orange-600/700,
     amber-500) দিয়ে বদলানো হলো।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_profile_header.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
APP_PATH = os.path.join(REPO_ROOT, "src", "App.tsx")

OLD1 = "                    <div className=\"w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-orange-550 to-amber-500 text-slate-950 font-black flex items-center justify-center shadow-md text-lg sm:text-xl select-none shrink-0\">\n                      গ\n                    </div>"
NEW1 = "                    <div className=\"w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden shadow-md shrink-0 bg-slate-900\">\n                      <img src=\"/icon-512.png\" alt=\"Gari Bazar\" className=\"w-full h-full object-cover\" />\n                    </div>"
OLD2 = "                            <button\n                              type=\"button\"\n                              onClick={() => setIsAuthOpen(true)}\n                              className=\"w-full bg-gradient-to-r from-amber-500 to-orange-550 hover:from-amber-600 hover:to-orange-605 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-550/15 cursor-pointer\"\n                            >"
NEW2 = "                            <button\n                              type=\"button\"\n                              onClick={() => setIsAuthOpen(true)}\n                              className=\"w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/15 cursor-pointer\"\n                            >"

def main():
    if not os.path.exists(APP_PATH):
        print("ERROR: src/App.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(APP_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False

    if NEW1 in content:
        print("SKIP: প্রোফাইল লোগো আইকন ইতিমধ্যে patched")
    elif OLD1 in content:
        content = content.replace(OLD1, NEW1, 1)
        changed = True
        print("OK: প্রোফাইল হেডারে লোগো বসানো হয়েছে")
    else:
        print("ERROR: প্রোফাইল আইকনের প্রত্যাশিত ব্লক খুঁজে পাওয়া যায়নি, ম্যানুয়ালি চেক করো")
        sys.exit(1)

    if NEW2 in content:
        print("SKIP: Sign In বাটনের রঙ ইতিমধ্যে patched")
    elif OLD2 in content:
        content = content.replace(OLD2, NEW2, 1)
        changed = True
        print("OK: Sign In বাটনের রঙ ঠিক করা হয়েছে")
    else:
        print("ERROR: Sign In বাটনের প্রত্যাশিত ব্লক খুঁজে পাওয়া যায়নি, ম্যানুয়ালি চেক করো")
        sys.exit(1)

    if changed:
        with open(APP_PATH, "w", encoding="utf-8") as f:
            f.write(content)

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/App.tsx")
    print('  git commit -m "fix: profile header logo + invalid gradient color shades"')
    print("  git push")
