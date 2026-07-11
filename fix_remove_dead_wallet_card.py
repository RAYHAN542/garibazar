#!/usr/bin/env python3
"""
Fix: The "Listing Coverage & Marketing Budget" card on the seller dashboard
(with the "Refill" button) tops up `simulatedCredits`, but that balance is
never actually spent/deducted anywhere to unlock an ad boost. Ad boosting is
a completely separate flow (per-listing TxID / UddoktaPay). So this card
was misleading users into refilling a wallet that does nothing useful.

This patch removes the card entirely from the dashboard.

Run from the repo root (where src/App.tsx lives):
    python3 fix_remove_dead_wallet_card.py
"""

import sys
import unicodedata
from pathlib import Path

FILE = Path("src/App.tsx")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''                {/* 3. Marketing Campaign Wallet Center (Clean version without Refer and Earn) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-5 h-5 text-amber-505" />
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white tracking-tight">
                          {language === "bn" ? "লিস্টিং কভারেজ ও মার্কেটিং বাজেট" : "Premium Campaign Wallet"}
                        </h4>
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-450 leading-normal">
                        {language === "bn" 
                          ? "আপনার পার্টস বিক্রির তালিকাগুলো টপ-স্লাইডারে প্রমোট করার ডেমো পেমেন্ট ও রিচার্জ গেটওয়ে।" 
                          : "Virtual sandbox ad balance used for testing listing spotlight bumps & carousel metrics."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                          {language === "bn" ? "চলতি বাজেট ব্যালেন্স" : "Ad Wallet Balance"}
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-orange-650 dark:text-orange-400 font-mono">
                          ৳{(userMetadata?.simulatedCredits ?? user?.simulatedCredits ?? 5000).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRechargeWallet}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-orange-500 hover:bg-orange-650 text-white dark:text-slate-950 font-extrabold text-[10px] sm:text-xs transition flex items-center gap-1 shadow-md shadow-orange-500/20 cursor-pointer border-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === "bn" ? "রিফিল করুন" : "Refill"}</span>
                      </button>
                    </div>
                  </div>
                </div>

'''

NEW = ''''''


def main():
    if not FILE.exists():
        print(f"ERROR: {FILE} not found. Run this from the repo root (garibazar-main).")
        sys.exit(1)

    content = nfc(FILE.read_text(encoding="utf-8"))
    old = nfc(OLD)

    count = content.count(old)
    if count == 0:
        print("ERROR: could not find the wallet card block. File may have changed — aborting, no changes written.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: block matched {count} times (expected 1) — aborting, no changes written.")
        sys.exit(1)

    content = content.replace(old, NEW, 1)

    backup = FILE.with_suffix(".tsx.bak4")
    backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    FILE.write_text(content, encoding="utf-8")

    print("Patched src/App.tsx successfully.")
    print(f"Backup saved at {backup}")
    print("The non-functional Ad Wallet / Refill card has been removed from the dashboard.")
    print("(The RefillModal component, handleRechargeWallet, and isRefillModalOpen state")
    print(" still exist in the file but are now unreachable/unused — harmless dead code.)")


if __name__ == "__main__":
    main()
