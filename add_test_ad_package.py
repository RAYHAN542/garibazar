#!/usr/bin/env python3
"""
Adds a cheap ৳20 / 1-day test ad-boost package so the real UddoktaPay /
manual-TxID payment flow can be tested with a small real amount instead of
having to spend ৳500+ just to test.

Appended at the END of AD_PACKAGES (not inserted at the front) so existing
package indices/defaults elsewhere in the app don't shift.

Run from the repo root (where src/translations.ts lives):
    python3 add_test_ad_package.py
"""

import sys
import unicodedata
from pathlib import Path

FILE = Path("src/translations.ts")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''    tier: "featured"
  }
];'''

NEW = '''    tier: "featured"
  },
  {
    id: "pkg-test",
    nameEn: "Quick Test Boost",
    nameBn: "কুইক টেস্ট বুস্ট",
    price: 20,
    durationDays: 1,
    benefitsEn: [
      "For testing the real payment flow with a small amount",
      "1 day of basic promoted visibility"
    ],
    benefitsBn: [
      "রিয়েল পেমেন্ট ফ্লো অল্প টাকায় টেস্ট করার জন্য",
      "১ দিনের বেসিক প্রমোটেড ভিজিবিলিটি"
    ],
    tier: "basic"
  }
];'''


def main():
    if not FILE.exists():
        print(f"ERROR: {FILE} not found. Run this from the repo root (garibazar-main).")
        sys.exit(1)

    content = nfc(FILE.read_text(encoding="utf-8"))
    old = nfc(OLD)

    count = content.count(old)
    if count == 0:
        print("ERROR: could not find the end of AD_PACKAGES array. File may have changed — aborting, no changes written.")
        sys.exit(1)
    if count > 1:
        print(f"ERROR: block matched {count} times (expected 1) — aborting, no changes written.")
        sys.exit(1)

    content = content.replace(old, NEW, 1)

    backup = FILE.with_suffix(".ts.bak")
    backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    FILE.write_text(content, encoding="utf-8")

    print("Patched src/translations.ts successfully.")
    print(f"Backup saved at {backup}")
    print('Added "কুইক টেস্ট বুস্ট" — ৳20 / 1 day — as a new selectable package.')


if __name__ == "__main__":
    main()
