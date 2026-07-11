#!/usr/bin/env python3
"""
Fix: RefillModal.tsx's "Online Checkout Portal" tab already redirects to a
REAL UddoktaPay checkout page (see handleRealPaymentGateway), but the UI
text was left over from before that integration — it still says "DEMO MODE,
no real money will be charged" and "mock-pay instantly". That's misleading
now that real bKash/Nagad/Rocket money actually gets charged.

This patch replaces the stale demo banner + description with accurate text.

Run from the repo root (where src/components/RefillModal.tsx lives):
    python3 fix_refill_demo_text.py
"""

import sys
import unicodedata
from pathlib import Path

FILE = Path("src/components/RefillModal.tsx")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD1 = '''        {/* PROMINENT DEMO MODE WARNING BANNER */}
        <div className="bg-amber-500 text-slate-950 px-5 py-3 font-black text-xs text-center shrink-0 flex flex-col items-center justify-center gap-1 border-b border-amber-600 shadow-sm animate-pulse z-10">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm">⚠️</span>
            <span className="tracking-tight uppercase">
              {language === "bn"
                ? "ডেমো মোড — এটা real payment বা রিচার্জ না।"
                : "DEMO MODE — This is a simulated recharge."}
            </span>
          </div>
          <span className="text-[11px] font-extrabold opacity-90">
            {language === "bn"
              ? "কোনো আসল টাকা কাটা হবে না।"
              : "No real money will be charged or deducted."}
          </span>
        </div>'''

NEW1 = '''        {/* SECURE REAL PAYMENT BANNER (UddoktaPay-verified) */}
        <div className="bg-emerald-600 text-white px-5 py-3 font-black text-xs text-center shrink-0 flex flex-col items-center justify-center gap-1 border-b border-emerald-700 shadow-sm z-10">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm">🔒</span>
            <span className="tracking-tight uppercase">
              {language === "bn"
                ? "নিরাপদ রিয়েল পেমেন্ট — UddoktaPay দ্বারা যাচাইকৃত"
                : "Secure Real Payment — Verified via UddoktaPay"}
            </span>
          </div>
          <span className="text-[11px] font-extrabold opacity-90">
            {language === "bn"
              ? "পেমেন্ট সফল হলে আসল টাকা কাটা হবে এবং ব্যালেন্স যোগ হবে।"
              : "Real money will be charged upon successful payment and credited to your balance."}
          </span>
        </div>'''

OLD2 = '''                {language === "bn" 
                  ? "পেমেন্ট গেটওয়ে অপশন দিয়ে আপনি bKash/Nagad/Rocket এর যেকোনো অ্যাকাউন্ট অথবা ইন্টারফেস ব্যবহার করে সরাসরি মক পেমেন্ট করতে পারবেন। পেমেন্ট কনফার্ম হওয়া মাত্রই ব্যালেন্স ইনস্ট্যান্ট বেড়ে যাবে!"
                  : "Using the secure online gateway option, you can mock-pay instantly via authentic bKash, Nagad, or Rocket themed web checkout pages. Refill adds credits to your account immediately with no admin wait!"}'''

NEW2 = '''                {language === "bn" 
                  ? "এই অপশনে আপনি bKash/Nagad/Rocket দিয়ে UddoktaPay-এর নিরাপদ চেকআউট পেজে সরাসরি real পেমেন্ট করতে পারবেন। পেমেন্ট কনফার্ম হওয়া মাত্রই ব্যালেন্স ইনস্ট্যান্ট যোগ হয়ে যাবে!"
                  : "This option redirects you to UddoktaPay's secure checkout page to pay instantly and securely via bKash, Nagad, or Rocket. Your balance is credited the moment payment is confirmed!"}'''


def main():
    if not FILE.exists():
        print(f"ERROR: {FILE} not found. Run this from the repo root (garibazar-main).")
        sys.exit(1)

    content = nfc(FILE.read_text(encoding="utf-8"))

    for label, old, new in [("demo mode banner", OLD1, NEW1), ("mock payment description", OLD2, NEW2)]:
        old = nfc(old)
        new = nfc(new)
        count = content.count(old)
        if count == 0:
            print(f"ERROR: could not find the '{label}' block. File may have changed — aborting, no changes written.")
            sys.exit(1)
        if count > 1:
            print(f"ERROR: '{label}' block matched {count} times (expected 1) — aborting, no changes written.")
            sys.exit(1)
        content = content.replace(old, new, 1)

    backup = FILE.with_suffix(".tsx.bak")
    if not backup.exists():
        backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        backup = Path(str(FILE) + ".bak_demo_text")
        backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    FILE.write_text(content, encoding="utf-8")

    print("Patched src/components/RefillModal.tsx successfully.")
    print(f"Backup saved at {backup}")
    print("The wallet refill modal now correctly says this is a REAL payment (UddoktaPay), not a demo.")


if __name__ == "__main__":
    main()
