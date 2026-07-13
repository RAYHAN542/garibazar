#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Follow-up fix: searching "Car" still returned excavators/trucks after the
earlier fuzzy-match fix.

Root cause (different bug, same symptom): the direct substring match step
uses plain `.includes()`, which has no concept of word boundaries. Since
seller descriptions commonly contain words like "cargo" (trucks), "care" /
"carefully" (maintenance notes), etc., a search for "car" matches ANY
listing whose text merely *contains* those letters in sequence, not just
listings that are actually about cars.

Fix: add a small smartIncludes() helper. For queries that are plain
alphabetic words (no digits) - like "car", "bus", "cat" - it now requires
a real word-boundary match, so "car" no longer matches inside "cargo" or
"care". For alphanumeric/model-style queries (like "320", "e70") it keeps
the old loose substring behavior, since that's needed for things like
"320" matching "320B".

Run from the project root (the folder containing `src/`):
    python3 fix_search_word_boundary.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "App.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


OLD = '''      // 1. Direct Case-Insensitive Substring matches - highly precise & reliable for short numbers (like '320' -> '320 B')
      for (const item of enrichedListings) {
        const titleLoc = (item.title || "").toLowerCase();
        const brandLoc = (item.brand || "").toLowerCase();
        const modelLoc = (item.model || "").toLowerCase();
        const descLoc = (item.description || "").toLowerCase();
        const blobLoc = (item.searchBlob || "").toLowerCase();
        
        let isDirectMatch = false;
        for (const opt of searchOptions) {
          const optLower = opt.toLowerCase();
          if (
            titleLoc.includes(optLower) ||
            brandLoc.includes(optLower) ||
            modelLoc.includes(optLower) ||
            descLoc.includes(optLower) ||
            blobLoc.includes(optLower)
          ) {
            isDirectMatch = true;
            break;
          }
        }
        
        if (isDirectMatch) {
          seenIds.add(item.id);
          matchedItems.push(item);
        }
      }'''

NEW = '''      // Word-boundary aware substring check. Plain alphabetic queries (real
      // words like "car", "bus", "cat") require a true word boundary so they
      // don't match inside unrelated words like "cargo" or "carefully" -
      // alphanumeric/model-style queries (like "320", "e70") keep the old
      // loose substring behavior since that's needed for "320" -> "320B".
      const isPureAlpha = (s: string) => /^[a-z]+$/i.test(s) || /^[\\u0980-\\u09FF]+$/.test(s);
      const smartIncludes = (haystack: string, needle: string): boolean => {
        if (!needle) return false;
        if (!isPureAlpha(needle)) return haystack.includes(needle);
        const escaped = needle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
        const boundary = "[^a-zA-Z\\\\u0980-\\\\u09FF]";
        const re = new RegExp(`(^|${boundary})${escaped}($|${boundary})`, "i");
        return re.test(haystack);
      };

      // 1. Direct Case-Insensitive Substring matches - highly precise & reliable for short numbers (like '320' -> '320 B')
      for (const item of enrichedListings) {
        const titleLoc = (item.title || "").toLowerCase();
        const brandLoc = (item.brand || "").toLowerCase();
        const modelLoc = (item.model || "").toLowerCase();
        const descLoc = (item.description || "").toLowerCase();
        const blobLoc = (item.searchBlob || "").toLowerCase();
        
        let isDirectMatch = false;
        for (const opt of searchOptions) {
          const optLower = opt.toLowerCase();
          if (
            smartIncludes(titleLoc, optLower) ||
            smartIncludes(brandLoc, optLower) ||
            smartIncludes(modelLoc, optLower) ||
            smartIncludes(descLoc, optLower) ||
            smartIncludes(blobLoc, optLower)
          ) {
            isDirectMatch = true;
            break;
          }
        }
        
        if (isDirectMatch) {
          seenIds.add(item.id);
          matchedItems.push(item);
        }
      }'''


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
    print("[OK] App.tsx: patched (word-boundary matching added for alphabetic search queries)")


if __name__ == "__main__":
    main()
