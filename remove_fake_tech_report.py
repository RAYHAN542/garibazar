#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Removes the fake "Gari Bazar Technical Evaluation" / "Deep Analyzed" panel
from the listing detail page.

That panel was 100% hardcoded fabricated data (fixed "Engine Health 95%",
"Mileage: 64,000 km", etc. for every car; fixed numbers for every excavator,
dozer, crane, loader) selected only by keyword-matching the title/model
text - none of it reflected the real listing. Presenting this as a
"Technical Expert Inspection Verdict" could mislead real buyers into
trusting a fake inspection. This script deletes the feature entirely:
the getTechnicalAnalysis() function, the techReport variable, and the
JSX block that rendered it.

Run from the project root (the folder containing `src/`):
    python3 remove_fake_tech_report.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "components" / "ListingDetailModal.tsx"

FUNC_START_MARKER = "  // Dynamic specs extraction for Deep Technical Analysis of vehicles and parts\n"
FUNC_END_MARKER = "  const techReport = getTechnicalAnalysis();\n\n"

JSX_START_MARKER = "              {techReport && (\n"
JSX_END_MARKER = "                </div>\n              )}\n\n"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def remove_block(text: str, start_marker: str, end_marker: str, label: str) -> str:
    start_idx = text.find(start_marker)
    if start_idx == -1:
        print(f"[WARN] {label}: start marker not found, skipping")
        return text
    end_search_from = start_idx + len(start_marker)
    end_idx = text.find(end_marker, end_search_from)
    if end_idx == -1:
        print(f"[WARN] {label}: end marker not found, skipping")
        return text
    end_idx += len(end_marker)
    text = text[:start_idx] + text[end_idx:]
    print(f"[OK] {label}: removed")
    return text


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))

    text = remove_block(text, nfc(FUNC_START_MARKER), nfc(FUNC_END_MARKER), "getTechnicalAnalysis() function + techReport variable")
    text = remove_block(text, nfc(JSX_START_MARKER), nfc(JSX_END_MARKER), "fake technical evaluation JSX panel")

    TARGET.write_text(text, encoding="utf-8")
    print("[DONE] ListingDetailModal.tsx updated")


if __name__ == "__main__":
    main()
