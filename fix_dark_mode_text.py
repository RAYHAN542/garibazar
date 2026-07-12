#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix: input/select text becomes invisible (washed-out/near-white on white
background) when the phone's SYSTEM dark mode is on.

Root cause: index.html never declares `color-scheme`, so Android Chrome
applies its "Auto Dark Theme" heuristic to the page. It force-recolors
unstyled default text (like plain <input>/<select> text) to a light color,
but leaves explicitly-authored white backgrounds untouched - producing
near-invisible light text on a white box. This is separate from the app's
own manual light/dark toggle (the `.dark` class), which keeps working fine
since it's driven by explicit Tailwind classes, not native browser theming.

Adding `<meta name="color-scheme" content="light">` tells the browser the
page manages its own theming, so it stops guessing and stops breaking
unstyled form inputs.

Run from the project root (the folder containing `index.html`):
    python3 fix_dark_mode_text.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def main():
    path = ROOT / "index.html"
    if not path.exists():
        print(f"[SKIP] index.html not found at {path}")
        return

    text = nfc(path.read_text(encoding="utf-8"))

    if 'name="color-scheme"' in text:
        print("[SKIP] color-scheme meta tag already present, nothing to do")
        return

    old = '<meta name="theme-color" content="#f59e0b" />'
    new = (
        '<meta name="theme-color" content="#f59e0b" />\n'
        '    <meta name="color-scheme" content="light" />'
    )

    if old not in text:
        print("[WARN] expected theme-color line not found, no changes made")
        return

    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    print("[OK] index.html: patched (added color-scheme meta tag)")


if __name__ == "__main__":
    main()
