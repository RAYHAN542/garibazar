#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Closes a search gap: a plain Bengali listing like "গাড়ি বিক্রি হবে" (no
brand/model mentioned) was not found when searching the English word "car"
(and likewise bus/truck/bike/excavator/etc.) - there was no generic
vehicle-type alias linking the English and Bengali words. The existing
alias list only covered specific parts and specific brands (Toyota, Honda,
Caterpillar...), not generic vehicle-type terms.

This does two things in src/searchAliases.ts:

1. Adds a new alias group for common vehicle types so English<->Bengali
   search works for these general terms too.
2. Makes the alias-group detection itself word-boundary aware for plain
   alphabetic words. Without this, adding "car" as an alias trigger would
   quietly reopen the exact bug just fixed in App.tsx: a truck listing
   mentioning "cargo" would satisfy `rawText.includes("car")` and tag
   itself with the car alias, making it show up again for a "car" search.
   Numeric/model-style variants (like the "e70"/"320" caterpillar models)
   keep the old loose substring behavior, since that's intentional there.

Run from the project root (the folder containing `src/`):
    python3 add_vehicle_type_aliases.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "searchAliases.ts"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD_GROUPS_HEADER = '''export const SEARCH_ALIAS_GROUPS: string[][] = [
  // Common Parts and Spares (English / Bangla variants)'''

NEW_GROUPS_HEADER = '''export const SEARCH_ALIAS_GROUPS: string[][] = [
  // Generic vehicle-type terms (English / Bangla variants) - so a plain
  // listing like "গাড়ি বিক্রি হবে" (no brand/model mentioned) is still
  // found by an English "car" search, and vice versa.
  ["car", "গাড়ি", "গারি", "কার"],
  ["truck", "ট্রাক", "লরি", "lorry"],
  ["bus", "বাস"],
  ["bike", "motorcycle", "motorbike", "বাইক", "মোটরসাইকেল", "মোটর সাইকেল"],
  ["pickup", "pickup van", "পিকআপ", "পিক আপ"],
  ["jeep", "জিপ"],
  ["microbus", "micro bus", "মাইক্রোবাস", "মাইক্রো বাস"],
  ["cng", "সিএনজি", "অটো", "auto rickshaw", "অটোরিকশা"],
  ["excavator", "এক্সক্যাভেটর", "এক্সকাভেটর", "ভেকু"],
  ["crane", "ক্রেন"],
  ["bulldozer", "dozer", "বুলডোজার", "ডোজার"],
  ["forklift", "ফর্কলিফট", "ফর্কলিফ্ট"],
  ["loader", "লোডার"],
  ["tractor", "ট্রাক্টর"],

  // Common Parts and Spares (English / Bangla variants)'''

OLD_MATCH_LOOP = '''  const collectedAliases = new Set<string>();

  // If any keyword in a group is found in rawText, add all keywords of that group to aliases
  for (const group of SEARCH_ALIAS_GROUPS) {
    let matchesGroup = false;
    for (const variant of group) {
      if (rawText.includes(variant.toLowerCase())) {
        matchesGroup = true;
        break;
      }
    }
    if (matchesGroup) {
      for (const variant of group) {
        collectedAliases.add(variant);
      }
    }
  }'''

NEW_MATCH_LOOP = '''  const collectedAliases = new Set<string>();

  // Word-boundary aware check for alias-group triggers. Plain alphabetic
  // variants (real words like "car", "bus") require a true word boundary
  // so a truck listing mentioning "cargo" doesn't get tagged as a "car"
  // just because the letters happen to appear in sequence. Numeric/mixed
  // variants (like "e70", "320") keep the old loose substring behavior.
  const isPureAlphaWord = (s: string) => /^[a-z]+$/i.test(s) || /^[\\u0980-\\u09FF]+$/.test(s);
  const hasAliasMatch = (text: string, variant: string): boolean => {
    const v = variant.toLowerCase();
    if (!isPureAlphaWord(v)) return text.includes(v);
    const escaped = v.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    const boundary = "[^a-zA-Z\\\\u0980-\\\\u09FF]";
    const re = new RegExp(`(^|${boundary})${escaped}($|${boundary})`, "i");
    return re.test(text);
  };

  // If any keyword in a group is found in rawText, add all keywords of that group to aliases
  for (const group of SEARCH_ALIAS_GROUPS) {
    let matchesGroup = false;
    for (const variant of group) {
      if (hasAliasMatch(rawText, variant)) {
        matchesGroup = true;
        break;
      }
    }
    if (matchesGroup) {
      for (const variant of group) {
        collectedAliases.add(variant);
      }
    }
  }'''


def apply(text: str, old: str, new: str, label: str) -> str:
    if nfc(old) not in text:
        print(f"[WARN] {label}: expected snippet not found, skipping")
        return text
    print(f"[OK] {label}: patched")
    return text.replace(nfc(old), nfc(new), 1)


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))
    text = apply(text, OLD_GROUPS_HEADER, NEW_GROUPS_HEADER, "generic vehicle-type alias group")
    text = apply(text, OLD_MATCH_LOOP, NEW_MATCH_LOOP, "word-boundary aware alias matching")

    TARGET.write_text(text, encoding="utf-8")
    print("[DONE] searchAliases.ts updated")


if __name__ == "__main__":
    main()
