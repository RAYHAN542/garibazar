#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adds a "Download our Android App" banner to the Profile tab, right below
the branding header. Links directly to /gari-bazar.apk (the APK already
hosted in public/), so users can install the app without any app store.

Run from the project root (the folder containing `src/`):
    python3 add_apk_download_banner.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "App.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD_IMPORT = 'import { Car, Search, User, LogOut, Globe, Loader2, ShoppingBag, Phone, ChevronRight, ShieldCheck, Send, Check } from "lucide-react";'
NEW_IMPORT = 'import { Car, Search, User, LogOut, Globe, Loader2, ShoppingBag, Phone, ChevronRight, ShieldCheck, Send, Check, Download, Smartphone } from "lucide-react";'

OLD_BLOCK = '''                    </div>
                  </div>
                </div>

                {/* B. Settings Menu List styling modeled on user's Settings screenshot */}'''

NEW_BLOCK = '''                    </div>
                  </div>
                </div>

                {/* A2. Download Android App banner */}
                <a
                  href="/gari-bazar.apk"
                  download
                  className="flex items-center gap-3.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 shadow-sm text-white"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-extrabold leading-tight">
                      {language === "bn" ? "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড করুন" : "Download our Android App"}
                    </p>
                    <p className="text-[11px] sm:text-xs text-white/80 font-semibold mt-0.5">
                      {language === "bn" ? "দ্রুত ও সহজভাবে ব্যবহার করুন, ইনস্টল করে নিন" : "Faster, easier - install it now"}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Download className="w-4.5 h-4.5" />
                  </div>
                </a>

                {/* B. Settings Menu List styling modeled on user's Settings screenshot */}'''


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))
    changed = False

    if nfc(OLD_IMPORT) in text:
        text = text.replace(nfc(OLD_IMPORT), nfc(NEW_IMPORT), 1)
        changed = True
        print("[OK] added Download/Smartphone icon imports")
    else:
        print("[WARN] import line not found / already patched")

    if nfc(OLD_BLOCK) in text:
        text = text.replace(nfc(OLD_BLOCK), nfc(NEW_BLOCK), 1)
        changed = True
        print("[OK] inserted APK download banner into Profile tab")
    else:
        print("[WARN] insertion point not found / already patched")

    if changed:
        TARGET.write_text(text, encoding="utf-8")
        print("[DONE] App.tsx updated")
    else:
        print("[SKIP] nothing changed")


if __name__ == "__main__":
    main()
