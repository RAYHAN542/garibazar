#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: "Continue with Google" ও "Continue with Phone" বাটন দুটোর ডিজাইন এক
রকম করা হচ্ছে -- আগে Google বাটন সাদা/আউটলাইন আর Phone বাটন সলিড সবুজ ছিল,
যেটা দেখতে বেমানান লাগছিল। এখন দুটো বাটনের shape/padding/border সব একই,
শুধু বাম পাশের ছোট আইকন-বাজে রঙে পার্থক্য (Google সাদা বৃত্তে ওদের লোগো,
Phone অ্যাপের নিজস্ব amber/সোনালী ব্র্যান্ড কালারে ফোন আইকন)।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_auth_buttons.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
AUTHMODAL_PATH = os.path.join(REPO_ROOT, "src", "components", "AuthModal.tsx")

OLD_BLOCK = "        {step === \"start\" ? (\n          <div className=\"space-y-4\">\n            <p className=\"text-sm text-slate-500 dark:text-slate-400 text-center\">\n              {language === \"bn\"\n                ? \"গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য সাইন-ইন করুন।\"\n                : \"Sign in to buy or sell on Gari Bazar.\"}\n            </p>\n            <button\n              type=\"button\"\n              onClick={handleGoogleSignIn}\n              disabled={loading}\n              className=\"w-full py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-bold rounded-lg text-sm flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700\"\n            >\n              {loading ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <GoogleIcon />}\n              {language === \"bn\" ? \"Google দিয়ে চালিয়ে যান\" : \"Continue with Google\"}\n            </button>\n            <button\n              type=\"button\"\n              onClick={() => { setError(\"\"); setStep(\"phone\"); }}\n              disabled={loading}\n              className=\"w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2\"\n            >\n              <Phone className=\"w-4 h-4\" />\n              {language === \"bn\" ? \"মোবাইল নম্বর দিয়ে চালিয়ে যান\" : \"Continue with Phone\"}\n            </button>\n          </div>\n        ) : step === \"phone\" ? ("

NEW_BLOCK = "        {step === \"start\" ? (\n          <div className=\"space-y-3\">\n            <p className=\"text-sm text-slate-500 dark:text-slate-400 text-center mb-1\">\n              {language === \"bn\"\n                ? \"গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য সাইন-ইন করুন।\"\n                : \"Sign in to buy or sell on Gari Bazar.\"}\n            </p>\n            <button\n              type=\"button\"\n              onClick={handleGoogleSignIn}\n              disabled={loading}\n              className=\"w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700\"\n            >\n              <span className=\"w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm\">\n                {loading ? <Loader2 className=\"w-4 h-4 animate-spin text-slate-500\" /> : <GoogleIcon />}\n              </span>\n              {language === \"bn\" ? \"Google দিয়ে চালিয়ে যান\" : \"Continue with Google\"}\n            </button>\n            <button\n              type=\"button\"\n              onClick={() => { setError(\"\"); setStep(\"phone\"); }}\n              disabled={loading}\n              className=\"w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700\"\n            >\n              <span className=\"w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-sm\">\n                <Phone className=\"w-4 h-4 text-slate-900\" />\n              </span>\n              {language === \"bn\" ? \"মোবাইল নম্বর দিয়ে চালিয়ে যান\" : \"Continue with Phone\"}\n            </button>\n          </div>\n        ) : step === \"phone\" ? ("

def main():
    if not os.path.exists(AUTHMODAL_PATH):
        print("ERROR: AuthModal.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(AUTHMODAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if NEW_BLOCK in content:
        print("SKIP: বাটন স্টাইল ইতিমধ্যে patched")
        return

    if OLD_BLOCK not in content:
        print("ERROR: প্রত্যাশিত বাটন ব্লক খুঁজে পাওয়া যায়নি।")
        print("       (phone+password patch আগে চালিয়ে থাকলে সেটা এই ব্লক বদলায়নি,")
        print("        তাই এটা যেকোনো ক্রমে চালানো নিরাপদ। তারপরও সমস্যা হলে জানাও।)")
        sys.exit(1)

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    with open(AUTHMODAL_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: src/components/AuthModal.tsx বাটন স্টাইল patched")

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/components/AuthModal.tsx")
    print('  git commit -m "style: unify Google/Phone auth button design"')
    print("  git push")
