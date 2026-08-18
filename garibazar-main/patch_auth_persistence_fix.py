#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: "Database is closing/hidden" error ঠিক করা -- Firebase Auth ডিফল্টে
IndexedDB ব্যবহার করে sign-in state রাখে, কিন্তু কিছু Android browser/
incognito mode-এ IndexedDB ঠিকভাবে কাজ করে না। এখন sessionStorage-ভিত্তিক
persistence (browserSessionPersistence) ব্যবহার করা হচ্ছে, যেটা অনেক বেশি
নির্ভরযোগ্য। আগের ডিবাগ error message-ও আবার সাধারণ, পরিষ্কার মেসেজে
ফিরিয়ে আনা হলো যেহেতু আসল কারণ পাওয়া গেছে।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_auth_persistence_fix.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
FIREBASE_PATH = os.path.join(REPO_ROOT, "src", "firebase.ts")
AUTHMODAL_PATH = os.path.join(REPO_ROOT, "src", "components", "AuthModal.tsx")

FIREBASE_OLD1 = "import { initializeApp } from \"firebase/app\";\nimport { getAuth, GoogleAuthProvider, FacebookAuthProvider } from \"firebase/auth\";\nimport { initializeFirestore } from \"firebase/firestore\";\nimport { getStorage } from \"firebase/storage\";\nimport { logger } from \"./utils/logger\";"
FIREBASE_NEW1 = "import { initializeApp } from \"firebase/app\";\nimport { getAuth, GoogleAuthProvider, FacebookAuthProvider, setPersistence, browserSessionPersistence } from \"firebase/auth\";\nimport { initializeFirestore } from \"firebase/firestore\";\nimport { getStorage } from \"firebase/storage\";\nimport { logger } from \"./utils/logger\";"
FIREBASE_OLD2 = "export const auth = getAuth(app);\nexport const googleProvider = new GoogleAuthProvider();\nexport const facebookProvider = new FacebookAuthProvider();"
FIREBASE_NEW2 = "export const auth = getAuth(app);\nexport const googleProvider = new GoogleAuthProvider();\nexport const facebookProvider = new FacebookAuthProvider();\n\n// কিছু Android browser/incognito mode-এ IndexedDB ঠিকভাবে কাজ করে না\n// (Firebase Auth-এর ডিফল্ট persistence পদ্ধতি), যার ফলে sign-in \"Database is\n// closing/hidden\" জাতীয় error দিয়ে ব্যর্থ হয়। sessionStorage-ভিত্তিক\n// persistence অনেক বেশি নির্ভরযোগ্য এবং redirect flow-এর জন্যও যথেষ্ট।\nsetPersistence(auth, browserSessionPersistence).catch((err) => {\n  logger.debug(\"Failed to set browserSessionPersistence, using default:\", err);\n});"

AUTHMODAL_DEBUG = "      } else {\n        console.error(err);\n        // সাময়িক ডিবাগ তথ্য: আসল Firebase error code দেখানো হচ্ছে, যাতে\n        // ঠিক কী কারণে sign-in ব্যর্থ হচ্ছে সেটা বোঝা যায় (কাজ শেষ হলে এই\n        // ডিবাগ অংশটা সরিয়ে আবার সাধারণ মেসেজে ফেরত নিয়ে যাওয়া উচিত)।\n        setError(\n          (language === \"bn\" ? \"Google সাইন-ইন ব্যর্থ হয়েছে। \" : \"Google sign-in failed. \") +\n          `[DEBUG code: ${code || \"unknown\"}] ${err?.message || \"\"}`\n        );\n      }"
AUTHMODAL_CLEAN = "      } else {\n        console.error(err);\n        setError(language === \"bn\" ? \"Google সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।\" : \"Google sign-in failed. Please try again.\");\n      }"


def patch_firebase():
    if not os.path.exists(FIREBASE_PATH):
        print("ERROR: src/firebase.ts পাওয়া যায়নি")
        sys.exit(1)
    with open(FIREBASE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if "browserSessionPersistence" in content:
        print("SKIP: firebase.ts ইতিমধ্যে patched")
        return

    if FIREBASE_OLD1 not in content or FIREBASE_OLD2 not in content:
        print("ERROR: firebase.ts-এর প্রত্যাশিত অংশ খুঁজে পাওয়া যায়নি, ম্যানুয়ালি চেক করো")
        sys.exit(1)

    content = content.replace(FIREBASE_OLD1, FIREBASE_NEW1, 1)
    content = content.replace(FIREBASE_OLD2, FIREBASE_NEW2, 1)
    with open(FIREBASE_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: src/firebase.ts patched (sessionStorage persistence)")


def clean_debug_message():
    if not os.path.exists(AUTHMODAL_PATH):
        print("ERROR: AuthModal.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(AUTHMODAL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if AUTHMODAL_DEBUG in content:
        content = content.replace(AUTHMODAL_DEBUG, AUTHMODAL_CLEAN, 1)
        with open(AUTHMODAL_PATH, "w", encoding="utf-8") as f:
            f.write(content)
        print("OK: AuthModal.tsx-এর ডিবাগ error message সরানো হয়েছে")
    elif AUTHMODAL_CLEAN in content:
        print("SKIP: AuthModal.tsx-এ ইতিমধ্যে সাধারণ মেসেজ আছে (ডিবাগ প্যাচ চালানো হয়নি বা আগেই সরানো হয়েছে)")
    else:
        print("WARNING: AuthModal.tsx-এর error message ব্লক প্রত্যাশিত অবস্থায় নেই, ম্যানুয়ালি চেক করো")


if __name__ == "__main__":
    patch_firebase()
    clean_debug_message()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/firebase.ts src/components/AuthModal.tsx")
    print('  git commit -m "fix: use sessionStorage auth persistence to fix IndexedDB sign-in failures"')
    print("  git push")
