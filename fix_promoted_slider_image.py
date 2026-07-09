#!/usr/bin/env python3
"""
Fix: বুস্ট বিজ্ঞাপনে ছবি কালো/খালি দেখায় (parts listing-এর ছবি images[] array-তে
থাকে, কিন্তু PromotedSlider শুধু singular 'image' ফিল্ড দেখে)।
Run from inside your project root (e.g. ~/garibazar_fixed):
    python fix_promoted_slider_image.py
"""
import sys

path = "src/components/PromotedSlider.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = """        {/* Full-bleed cover image */}
        {currentItem.image ? (
          <img
            src={currentItem.image}
            alt={currentItem.title}"""

new = """        {/* Full-bleed cover image */}
        {(currentItem.images?.[0] || currentItem.image) ? (
          <img
            src={currentItem.images?.[0] || currentItem.image}
            alt={currentItem.title}"""

if old not in content:
    print("[SKIP] প্যাচ টার্গেট পাওয়া যায়নি — সম্ভবত আগেই প্যাচ করা আছে।")
    sys.exit(1)

content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"✅ Patch applied to {path}")
print("এখন git diff চেক করে commit/push করো:")
print("  git diff src/components/PromotedSlider.tsx")
print("  git add src/components/PromotedSlider.tsx")
print('  git commit -m "Fix boosted ad banner showing black/missing image for parts listings"')
print("  git push")
