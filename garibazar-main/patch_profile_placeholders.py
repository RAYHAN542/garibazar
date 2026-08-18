#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: "Complete Your Profile" ফর্মে Name ও Mobile Number ফিল্ডে বাস্তব
example (real-looking) নাম/নম্বর ("Rayhan", "01993878271") placeholder
হিসেবে hardcoded ছিল -- এটা দেখতে যেন real filled data মনে হচ্ছিল, যদিও
আসলে ফিল্ড খালিই ছিল। এখন generic placeholder text ব্যবহার করা হলো।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_profile_placeholders.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
AUTHMODAL_PATH = os.path.join(REPO_ROOT, "src", "components", "AuthModal.tsx")

OLD1 = "                <input type=\"text\" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className=\"w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white\" placeholder=\"Rayhan\" />"
NEW1 = "                <input type=\"text\" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className=\"w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white\" placeholder={language === \"bn\" ? \"আপনার নাম লিখুন\" : \"Your name\"} />"
OLD2 = "                <input type=\"tel\" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className=\"w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white\" placeholder=\"01993878271\" />"
NEW2 = "                <input type=\"tel\" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className=\"w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white\" placeholder=\"01XXXXXXXXX\" />"

def main():
    if not os.path.exists(AUTHMODAL_PATH):
        print("ERROR: AuthModal.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(AUTHMODAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False

    if NEW1 in content:
        print("SKIP: নামের placeholder ইতিমধ্যে patched")
    elif OLD1 in content:
        content = content.replace(OLD1, NEW1, 1)
        changed = True
        print("OK: নামের placeholder generic করা হয়েছে")
    else:
        print("ERROR: নামের ইনপুট ব্লক খুঁজে পাওয়া যায়নি")
        sys.exit(1)

    if NEW2 in content:
        print("SKIP: মোবাইল নম্বরের placeholder ইতিমধ্যে patched")
    elif OLD2 in content:
        content = content.replace(OLD2, NEW2, 1)
        changed = True
        print("OK: মোবাইল নম্বরের placeholder generic করা হয়েছে")
    else:
        print("ERROR: মোবাইল নম্বর ইনপুট ব্লক খুঁজে পাওয়া যায়নি")
        sys.exit(1)

    if changed:
        with open(AUTHMODAL_PATH, "w", encoding="utf-8") as f:
            f.write(content)

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/components/AuthModal.tsx")
    print('  git commit -m "fix: use generic placeholders in profile form instead of real-looking sample data"')
    print("  git push")
