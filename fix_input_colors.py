#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Follow-up fix for invisible/washed-out input text on Android.

The color-scheme meta tag fix wasn't enough - Chrome/MIUI is still
force-recoloring the text inside <input>/<select>/<textarea> fields in
AddPartForm.tsx because those fields never explicitly declared their own
background/text color (they only had generic classes like "border
rounded-lg text-sm"). Auto-dark heuristics specifically target elements
that look "unstyled", so this adds explicit `bg-white text-gray-900` to
every field in the Post Ad form - once the browser sees the author has
deliberately set both colors, it should stop overriding them.

Run from the project root (the folder containing `src/`):
    python3 fix_input_colors.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "src" / "components" / "AddPartForm.tsx"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def main():
    if not TARGET.exists():
        print(f"[SKIP] file not found at {TARGET}")
        return

    text = nfc(TARGET.read_text(encoding="utf-8"))

    old_generic = 'className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500"'
    new_generic = 'className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500"'

    old_select = 'className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-orange-500"'
    new_select = 'className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500"'

    count_generic = text.count(old_generic)
    count_select = text.count(old_select)

    if count_generic == 0 and count_select == 0:
        print("[SKIP] expected class strings not found - file may have already been changed")
        return

    if count_generic:
        text = text.replace(old_generic, new_generic)
        print(f"[OK] patched {count_generic} plain input/textarea field(s)")

    if count_select:
        text = text.replace(old_select, new_select)
        print(f"[OK] patched {count_select} select field(s)")

    TARGET.write_text(text, encoding="utf-8")
    print("[DONE] AddPartForm.tsx updated")


if __name__ == "__main__":
    main()
