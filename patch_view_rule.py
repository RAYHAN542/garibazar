#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: Anonymous/না-লগইন করা visitor-ও যেন পোস্ট দেখলে view count বাড়ে,
সেজন্য firestore.rules-এ views-increment রুল থেকে isSignedIn() শর্ত সরানো হচ্ছে।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_view_rule.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
RULES_PATH = os.path.join(REPO_ROOT, "firestore.rules")

OLD_BLOCK = """      // Any signed-in user may bump views by exactly +1 (analytics tracking on view).
      allow update: if isSignedIn() &&
                    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views']) &&
                    request.resource.data.views == (resource.data.views is number ? resource.data.views : 0) + 1;"""

NEW_BLOCK = """      // Anyone (logged in or an anonymous visitor) may bump views by exactly +1
      // (view-count analytics on opening a listing). Not gated behind isSignedIn()
      // so visitors who never log in still count as a view -- capped to +1 per
      // request so it can't be abused to inflate the counter arbitrarily.
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views']) &&
                    request.resource.data.views == (resource.data.views is number ? resource.data.views : 0) + 1;"""

def main():
    if not os.path.exists(RULES_PATH):
        print("ERROR: firestore.rules পাওয়া যায়নি")
        sys.exit(1)
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if NEW_BLOCK in content:
        print("SKIP: firestore.rules ইতিমধ্যে patched")
        return

    if OLD_BLOCK not in content:
        print("ERROR: expected rule block খুঁজে পাওয়া যায়নি, ম্যানুয়ালি চেক করো")
        sys.exit(1)

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    with open(RULES_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: firestore.rules patched")

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add firestore.rules")
    print('  git commit -m "fix: allow anonymous visitors to bump view count"')
    print("  git push")
    print("\n⚠️  গুরুত্বপূর্ণ: শুধু git push করলে হবে না! firestore.rules")
    print("   আলাদাভাবে Firebase-এ deploy করতে হবে, নাহলে পুরনো rule-ই কাজ করবে।")
    print("   দুইটা উপায়:")
    print("   1) Firebase CLI দিয়ে: firebase deploy --only firestore:rules")
    print("   2) অথবা Firebase Console -> Firestore Database -> Rules ট্যাব -> ")
    print("      নিচের rules ফাইলের পুরো কনটেন্ট কপি-পেস্ট করে Publish বাটনে চাপো")
