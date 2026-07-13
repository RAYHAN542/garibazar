#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix: searching "Car" returns excavator listings.

Root cause: Fuse.js fuzzy fallback search (threshold 0.4) treats short
words like "car" (3 letters) as close enough to "cat" (1-letter edit
distance) to count as a match. Nearly every excavator listing mentions
the "CAT" (Caterpillar) brand, so any 3-letter query close to "cat" pulls
in every CAT-branded excavator - unrelated to what was actually searched.

Fix: skip the fuzzy fallback for very short search tokens (<= 3 chars).
Exact substring matching (step 1, already in the code) still handles
short exact terms like "car", "320", "e70" precisely - it's only the
fuzzy layer's imprecision on short strings that caused the false matches.

Run from the project root (the folder containing `src/`):
    python3 fix_search_fuzzy_falsematch.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "App.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''      // 2. Fuzzy fallback matching via Fuse.js
      for (const q of searchOptions) {
        if (!q.trim()) continue;
        const results = fuseInstance.search(q);'''

NEW = '''      // 2. Fuzzy fallback matching via Fuse.js
      // Skip very short tokens (<= 3 chars) here - fuzzy edit-distance matching
      // on short strings is too imprecise (e.g. "car" ~ "cat") and causes
      // false positives like a "Car" search pulling in every CAT-branded
      // excavator listing. Exact substring matching above already covers
      // short exact terms reliably.
      for (const q of searchOptions) {
        if (!q.trim() || q.trim().length <= 3) continue;
        const results = fuseInstance.search(q);'''


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
    print("[OK] App.tsx: patched (fuzzy search now skips short/noisy tokens)")


if __name__ == "__main__":
    main()
