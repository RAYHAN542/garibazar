#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
সাময়িক ডিবাগ প্যাচ: Google sign-in ব্যর্থ হলে এখন generic মেসেজের বদলে
আসল Firebase error code স্ক্রিনে দেখাবে। এতে ঠিক কেন sign-in fail হচ্ছে
(unauthorized-domain, network-request-failed, ইত্যাদি) বোঝা যাবে।
আসল কারণ বের হয়ে গেলে এই ডিবাগ মেসেজ আবার সরিয়ে ফেলা উচিত।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_debug_google_error.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
AUTHMODAL_PATH = os.path.join(REPO_ROOT, "src", "components", "AuthModal.tsx")

OLD_BLOCK = "      } else {\n        console.error(err);\n        setError(language === \"bn\" ? \"Google সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।\" : \"Google sign-in failed. Please try again.\");\n      }"

NEW_BLOCK = "      } else {\n        console.error(err);\n        // সাময়িক ডিবাগ তথ্য: আসল Firebase error code দেখানো হচ্ছে, যাতে\n        // ঠিক কী কারণে sign-in ব্যর্থ হচ্ছে সেটা বোঝা যায় (কাজ শেষ হলে এই\n        // ডিবাগ অংশটা সরিয়ে আবার সাধারণ মেসেজে ফেরত নিয়ে যাওয়া উচিত)।\n        setError(\n          (language === \"bn\" ? \"Google সাইন-ইন ব্যর্থ হয়েছে। \" : \"Google sign-in failed. \") +\n          `[DEBUG code: ${code || \"unknown\"}] ${err?.message || \"\"}`\n        );\n      }"

def main():
    if not os.path.exists(AUTHMODAL_PATH):
        print("ERROR: AuthModal.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(AUTHMODAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if "DEBUG code:" in content:
        print("SKIP: ডিবাগ প্যাচ ইতিমধ্যে বসানো আছে")
        return

    if OLD_BLOCK not in content:
        print("ERROR: প্রত্যাশিত error-handling ব্লক খুঁজে পাওয়া যায়নি।")
        print("       (আগে patch_pwa_google_signin.py চালিয়ে থাকতে হবে, তাহলে এই ব্লক মিলবে)")
        sys.exit(1)

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    with open(AUTHMODAL_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: src/components/AuthModal.tsx patched (temporary debug error message)")

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/components/AuthModal.tsx")
    print('  git commit -m "debug: show real Google sign-in error code temporarily"')
    print("  git push")
    print("\nDeploy হওয়ার পর আবার Google sign-in try করে যেই error code দেখায়")
    print("সেটার screenshot পাঠাও, তাহলে আসল কারণ বের করে স্থায়ী সমাধান দিতে পারব।")
