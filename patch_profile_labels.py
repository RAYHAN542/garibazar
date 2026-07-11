#!/usr/bin/env python3
"""
Shortens the settings/profile menu titles & subtitles in ProfileTab.tsx
so they're clean and easy for anyone to understand (removes English
parentheses clutter + simplifies jargon).

Run from your repo root:
    python3 patch_profile_labels.py
"""
import unicodedata

FILE = "src/components/ProfileTab.tsx"

REPLACEMENTS = [
    # Personal Info
    ("ব্যক্তিগত তথ্য (Personal info)", "ব্যক্তিগত তথ্য"),
    ("লগইন করতে এখানে চাপুন", "লগইন করুন"),
    # My Shop
    ("আমার দোকান (My Shop)", "আমার দোকান"),
    ("আপনার পাবলিক দোকান এবং লিস্টিং দেখুন", "আপনার দোকান দেখুন"),
    ("আপনার দোকান দেখতে লগইন করুন", "লগইন করুন"),
    # Change language
    ("ভাষা পরিবর্তন করুন (Change language)", "ভাষা পরিবর্তন"),
    ("বাংলা ও ইংরেজি ভাষা নির্ধারণ করুন", "বাংলা বা ইংরেজি বেছে নিন"),
    # Dark mode
    ("ডার্ক মোড (Dark mode)", "ডার্ক মোড"),
    ("আপনার চোখের সুবিধার্থে থিম পরিবর্তন করুন", "রাতে চোখের আরামের জন্য"),
    # Team
    ("আমাদের টিম ও গাড়ি বাজার", "আমাদের টিম"),
    ("অ্যাপ ডেভেলপমেন্ট টিম এবং লক্ষ্য", "যারা অ্যাপ তৈরি করেছে"),
    # Terms & Policy
    ("শর্তাবলী ও পলিসি কেন্দ্র", "শর্তাবলী ও নিয়ম"),
    ("প্লে স্টোর কমপ্লায়েন্স ও আইনি নীতিমালা", "নিয়ম ও শর্ত পড়ুন"),
    # Help / Support
    ("সাহায্য ও কন্টাক্ট সাপোর্ট", "সাহায্য কেন্দ্র"),
    ("টিমের সাথে সরাসরি যোগাযোগ করুন", "আমাদের সাথে যোগাযোগ করুন"),
]

def main():
    with open(FILE, encoding="utf-8") as f:
        content = f.read()

    content = unicodedata.normalize("NFC", content)

    changed = 0
    missing = []
    for old, new in REPLACEMENTS:
        old_n = unicodedata.normalize("NFC", old)
        new_n = unicodedata.normalize("NFC", new)
        count = content.count(old_n)
        if count == 0:
            missing.append(old)
            continue
        content = content.replace(old_n, new_n)
        changed += count

    with open(FILE, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"Replaced {changed} string(s).")
    if missing:
        print("NOT FOUND (skipped):")
        for m in missing:
            print(" -", m)

if __name__ == "__main__":
    main()
