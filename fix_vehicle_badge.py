#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix: newly posted vehicle ads show as "পার্ট" (Part) instead of "গাড়ি" (Vehicle).

Root cause: AddPartForm.tsx saves the specific dropdown value into `category`
(e.g. "Car", "Excavator", "Engine") and ALSO saves the correct `type` field
("vehicle" / "part") based on the tab the user picked. But the badge/filter
logic in ListingCard.tsx, App.tsx, and EditListingModal.tsx checks
`category === "vehicles"` - a value that never actually gets saved - so it
always falls through to "Part". This patch makes those checks use the
reliable `type` field first, falling back to the old category check for
any legacy listings that don't have `type` set.

Run from the project root (the folder containing `src/`):
    python3 fix_vehicle_badge.py
"""
import io
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def patch_file(path: Path, replacements, label):
    if not path.exists():
        print(f"  [SKIP] {label}: file not found at {path}")
        return False
    text = path.read_text(encoding="utf-8")
    text = nfc(text)
    changed = False
    for old, new in replacements:
        old_n, new_n = nfc(old), nfc(new)
        if old_n not in text:
            print(f"  [WARN] {label}: expected snippet not found, skipping one replacement")
            continue
        count = text.count(old_n)
        if count > 1:
            print(f"  [WARN] {label}: snippet occurs {count} times, expected 1 - applying to all")
        text = text.replace(old_n, new_n)
        changed = True
    if changed:
        path.write_text(text, encoding="utf-8")
        print(f"  [OK] {label}: patched")
    else:
        print(f"  [SKIP] {label}: nothing changed")
    return changed


def main():
    print("Fixing vehicle/part badge + filter bug...\n")

    # 1. types.ts - add `type` field so TS knows about it
    patch_file(
        SRC / "types.ts",
        [(
            "  category: string;\n  subCategory?: string;\n",
            "  category: string;\n  subCategory?: string;\n"
            "  type?: string; // 'vehicle' | 'part' - set at creation, authoritative for badge/filtering\n",
        )],
        "types.ts",
    )

    # 2. ListingCard.tsx - fix the badge label logic
    patch_file(
        SRC / "components" / "ListingCard.tsx",
        [(
            '  const isVehicle = listing.category === "vehicles";',
            '  const isVehicle = (listing as any).type === "vehicle"\n'
            '    ? true\n'
            '    : (listing as any).type === "part"\n'
            '    ? false\n'
            '    : listing.category === "vehicles";',
        )],
        "components/ListingCard.tsx",
    )

    # 3. App.tsx - fix isItemVehicle() used for category filtering (গাড়ি / পার্ট tabs)
    patch_file(
        SRC / "App.tsx",
        [(
            'const isItemVehicle = (item: PartListing): boolean => {\n'
            '  if (!item) return false;\n'
            '  if (item.category === "vehicles") return true;\n'
            '  if (item.category === "spare_parts") return false;\n',
            'const isItemVehicle = (item: PartListing): boolean => {\n'
            '  if (!item) return false;\n'
            '  // Authoritative signal: set once at posting time in AddPartForm.tsx\n'
            '  if ((item as any).type === "vehicle") return true;\n'
            '  if ((item as any).type === "part") return false;\n'
            '  if (item.category === "vehicles") return true;\n'
            '  if (item.category === "spare_parts") return false;\n',
        )],
        "App.tsx (isItemVehicle)",
    )

    # 4. EditListingModal.tsx - same root cause affects the edit form's header/fields
    edit_path = SRC / "components" / "EditListingModal.tsx"
    edit_replacements = [
        (
            '            {listing.category === "vehicles"\n'
            '              ? (language === "bn" ? "গাড়ি ও ভারী যন্ত্রপাতি সম্পাদনা" : "Edit Vehicle Listing")\n'
            '              : (language === "bn" ? "পার্ট লিস্ট সম্পাদনা" : "Edit Part Listing")}',
            '            {((listing as any).type === "vehicle" || listing.category === "vehicles")\n'
            '              ? (language === "bn" ? "গাড়ি ও ভারী যন্ত্রপাতি সম্পাদনা" : "Edit Vehicle Listing")\n'
            '              : (language === "bn" ? "পার্ট লিস্ট সম্পাদনা" : "Edit Part Listing")}',
        ),
        (
            '                {listing.category === "vehicles"\n'
            '                  ? (language === "bn" ? "গাড়ি/যন্ত্রপাতির নাম বা টাইটেল *" : "Vehicle / Equipment Title *")\n'
            '                  : (language === "bn" ? "পার্ট লিস্টিং টাইটেল *" : "Part Listing Title *")}',
            '                {((listing as any).type === "vehicle" || listing.category === "vehicles")\n'
            '                  ? (language === "bn" ? "গাড়ি/যন্ত্রপাতির নাম বা টাইটেল *" : "Vehicle / Equipment Title *")\n'
            '                  : (language === "bn" ? "পার্ট লিস্টিং টাইটেল *" : "Part Listing Title *")}',
        ),
        (
            '                  {listing.category === "vehicles" ? (',
            '                  {((listing as any).type === "vehicle" || listing.category === "vehicles") ? (',
        ),
        (
            '                  {listing.category === "vehicles"\n'
            '                    ? (language === "bn" ? "দাম (টাকা) *" : "Price (BDT / ৳) *")\n'
            '                    : (language === "bn" ? "কার পার্টস এর দাম (টাকা) *" : "Price (BDT / ৳) *")}',
            '                  {((listing as any).type === "vehicle" || listing.category === "vehicles")\n'
            '                    ? (language === "bn" ? "দাম (টাকা) *" : "Price (BDT / ৳) *")\n'
            '                    : (language === "bn" ? "কার পার্টস এর দাম (টাকা) *" : "Price (BDT / ৳) *")}',
        ),
        (
            '              {listing.category !== "vehicles" ? (',
            '              {!((listing as any).type === "vehicle" || listing.category === "vehicles") ? (',
        ),
    ]
    patch_file(edit_path, edit_replacements, "components/EditListingModal.tsx")

    print("\nDone. Review the diff (git diff), then commit & push as usual.")


if __name__ == "__main__":
    main()
