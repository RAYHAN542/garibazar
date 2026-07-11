#!/usr/bin/env python3
"""
Fix: the "Online Gateway (No TxID)" button for AD BOOST payments opened a
fake SimulatedPaymentPortal that auto-approved ANY 11-digit sender number +
6-char "TxID" with zero real verification, then instantly set the listing's
isAd=true — meaning anyone could boost their listing for free. It was also
the DEFAULT tab shown to users.

This patch removes that button (and forces manual/admin-verified mode as
the only option), so ad boosts always go through the safe "pending ->
admin approves" path.

Run from the repo root (where src/App.tsx lives):
    python3 fix_ad_boost_fake_gateway.py
"""

import sys
from pathlib import Path

FILE = Path("src/App.tsx")

OLD1 = '''  const [adPayMode, setAdPayMode] = useState<"instant" | "manual">("instant");'''

NEW1 = '''  const [adPayMode, setAdPayMode] = useState<"instant" | "manual">("manual"); // "instant" gateway disabled (unverified) — manual admin-verified payment only'''

OLD2 = '''                          {/* Payment Mode Tab Selection - Direct Online bKash Checkout vs Manual Send Money */}
                          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-955 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setAdPayMode("instant");
                                setAdPromoError("");
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                adPayMode === "instant"
                                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span className="text-slate-955">
                                {language === "bn" ? "অনলাইন গেটওয়ে (No TxID)" : "Online Gateway (No TxID)"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdPayMode("manual");
                                setAdPromoError("");
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                adPayMode === "manual"
                                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                                  : "text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              }`}
                            >
                              <History className="w-3.5 h-3.5 text-slate-900" />
                              <span className="text-slate-955">
                                {language === "bn" ? "ম্যানুয়ালি সেন্ড মানি (TxID)" : "Manual Pay (TxID)"}
                              </span>
                            </button>
                          </div>'''

NEW2 = '''                          {/* Payment Method: Manual Send Money & TxID (Admin-Verified) — fake "instant" gateway removed */}
                          <div className="flex items-center justify-center gap-1.5 p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-md font-black text-xs">
                            <History className="w-3.5 h-3.5 text-slate-950" />
                            <span>
                              {language === "bn" ? "ম্যানুয়ালি সেন্ড মানি (TxID)" : "Manual Pay (TxID)"}
                            </span>
                          </div>'''


def main():
    if not FILE.exists():
        print(f"ERROR: {FILE} not found. Run this from the repo root (garibazar-main).")
        sys.exit(1)

    content = FILE.read_text(encoding="utf-8")

    for label, old, new in [("adPayMode default state", OLD1, NEW1), ("payment tab selector buttons", OLD2, NEW2)]:
        count = content.count(old)
        if count == 0:
            print(f"ERROR: could not find the '{label}' block. File may have changed — aborting, no changes written.")
            sys.exit(1)
        if count > 1:
            print(f"ERROR: '{label}' block matched {count} times (expected 1) — aborting, no changes written.")
            sys.exit(1)
        content = content.replace(old, new, 1)

    backup = FILE.with_suffix(".tsx.bak3")
    backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    FILE.write_text(content, encoding="utf-8")

    print("Patched src/App.tsx successfully.")
    print(f"Backup saved at {backup}")
    print("")
    print("What changed:")
    print("  - Ad boost payment now always uses Manual Pay (TxID) -> admin approves.")
    print("  - The unverified 'Online Gateway (No TxID)' button is gone; nobody")
    print("    can reach the fake auto-approve flow anymore.")
    print("  - The old instant-gateway code still exists in the file but is now")
    print("    unreachable (dead code) — safe to leave, or ask Claude to fully")
    print("    remove it later as cleanup.")


if __name__ == "__main__":
    main()
