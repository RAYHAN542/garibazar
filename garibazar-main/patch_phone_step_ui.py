#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: Phone sign-in step-এ দুটো ছোট UI ঠিক করা --
  1. মোবাইল নম্বর ইনপুট থেকে autoFocus সরানো, যাতে "Continue with Phone"
     চাপার সাথে সাথে কীবোর্ড নিজে থেকে না খুলে যায়।
  2. "Create new account" / "Already have an account?" লিংকটা বড় ও স্পষ্ট
     করা (font size বাড়ানো, dark mode-এও ভালো দেখানো)।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_phone_step_ui.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
AUTHMODAL_PATH = os.path.join(REPO_ROOT, "src", "components", "AuthModal.tsx")

OLD1 = "              <input\n                type=\"tel\"\n                required\n                autoFocus\n                value={otpPhone}"
NEW1 = "              <input\n                type=\"tel\"\n                required\n                value={otpPhone}"
OLD2 = "            <div className=\"flex items-center justify-between text-xs\">\n              <button type=\"button\" onClick={() => { setError(\"\"); setStep(\"start\"); }} className=\"flex items-center gap-1 text-slate-500 hover:underline\">\n                <ArrowLeft className=\"w-3 h-3\" />\n                {language === \"bn\" ? \"পেছনে যান\" : \"Back\"}\n              </button>\n              <button\n                type=\"button\"\n                onClick={() => { setError(\"\"); setPhoneAuthMode(phoneAuthMode === \"login\" ? \"signup\" : \"login\"); }}\n                className=\"text-emerald-600 font-bold hover:underline\"\n              >\n                {phoneAuthMode === \"login\"\n                  ? (language === \"bn\" ? \"নতুন অ্যাকাউন্ট তৈরি করুন\" : \"Create new account\")\n                  : (language === \"bn\" ? \"আগে থেকে অ্যাকাউন্ট আছে? সাইন-ইন\" : \"Already have an account? Sign in\")}\n              </button>\n            </div>"
NEW2 = "            <div className=\"flex items-center justify-between gap-2 text-xs pt-1\">\n              <button type=\"button\" onClick={() => { setError(\"\"); setStep(\"start\"); }} className=\"flex items-center gap-1 text-slate-500 hover:underline shrink-0\">\n                <ArrowLeft className=\"w-3 h-3\" />\n                {language === \"bn\" ? \"পেছনে যান\" : \"Back\"}\n              </button>\n              <button\n                type=\"button\"\n                onClick={() => { setError(\"\"); setPhoneAuthMode(phoneAuthMode === \"login\" ? \"signup\" : \"login\"); }}\n                className=\"text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline text-right\"\n              >\n                {phoneAuthMode === \"login\"\n                  ? (language === \"bn\" ? \"নতুন অ্যাকাউন্ট তৈরি করুন\" : \"Create new account\")\n                  : (language === \"bn\" ? \"আগে থেকে অ্যাকাউন্ট আছে? সাইন-ইন\" : \"Already have an account? Sign in\")}\n              </button>\n            </div>"

def main():
    if not os.path.exists(AUTHMODAL_PATH):
        print("ERROR: AuthModal.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(AUTHMODAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False

    if NEW1 in content:
        print("SKIP: autoFocus ইতিমধ্যে সরানো আছে")
    elif OLD1 in content:
        content = content.replace(OLD1, NEW1, 1)
        changed = True
        print("OK: মোবাইল নম্বর ইনপুট থেকে autoFocus সরানো হয়েছে")
    else:
        print("ERROR: মোবাইল নম্বর ইনপুটের প্রত্যাশিত ব্লক খুঁজে পাওয়া যায়নি")
        sys.exit(1)

    if NEW2 in content:
        print("SKIP: 'Create new account' লিংক ইতিমধ্যে patched")
    elif OLD2 in content:
        content = content.replace(OLD2, NEW2, 1)
        changed = True
        print("OK: 'Create new account' লিংক বড় করা হয়েছে")
    else:
        print("ERROR: toggle লিংকের প্রত্যাশিত ব্লক খুঁজে পাওয়া যায়নি")
        sys.exit(1)

    if changed:
        with open(AUTHMODAL_PATH, "w", encoding="utf-8") as f:
            f.write(content)

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/components/AuthModal.tsx")
    print('  git commit -m "style: bigger create-account link, no auto keyboard on phone step"')
    print("  git push")
