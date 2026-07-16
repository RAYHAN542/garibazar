import os

changed_parts = []

path = "src/translations.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

price_updates = [
    ('nameEn: "Basic Machine Boost",\n    nameBn: "বেসিক মেশিন বুস্ট",\n    price: 300,',
     'nameEn: "Basic Machine Boost",\n    nameBn: "বেসিক মেশিন বুস্ট",\n    price: 199,'),
    ('nameEn: "Premium Machine Highlights",\n    nameBn: "প্রিমিয়াম স্লাইডার বিজ্ঞাপন",\n    price: 500,',
     'nameEn: "Premium Machine Highlights",\n    nameBn: "প্রিমিয়াম স্লাইডার বিজ্ঞাপন",\n    price: 399,'),
    ('nameEn: "Sponsor Gold Spotlight",\n    nameBn: "গোল্ড ক্যাটাগরি স্পটলাইট বিজ্ঞাপন",\n    price: 1000,',
     'nameEn: "Sponsor Gold Spotlight",\n    nameBn: "গোল্ড ক্যাটাগরি স্পটলাইট বিজ্ঞাপন",\n    price: 699,'),
]

price_hits = 0
already_new = 0
for old, new in price_updates:
    if old in content:
        content = content.replace(old, new, 1)
        price_hits += 1
    elif new in content:
        already_new += 1
if price_hits:
    changed_parts.append(f"prices-updated:{price_hits}")
if already_new == len(price_updates):
    changed_parts.append("prices-already-updated")

old_test_pkg = '''    tier: "featured"
  },
  {
    id: "pkg-test",
    nameEn: "Quick Test Boost",
    nameBn: "কুইক টেস্ট বুস্ট",
    price: 20,
    durationDays: 1,
    benefitsEn: [
      "For testing the real payment flow with a small amount",
      "1 day of basic promoted visibility"
    ],
    benefitsBn: [
      "রিয়েল পেমেন্ট ফ্লো অল্প টাকায় টেস্ট করার জন্য",
      "১ দিনের বেসিক প্রমোটেড ভিজিবিলিটি"
    ],
    tier: "basic"
  }
];'''

new_test_pkg = '''    tier: "featured"
  }
];'''

if old_test_pkg in content:
    content = content.replace(old_test_pkg, new_test_pkg, 1)
    changed_parts.append("test-package-removed")
elif '"pkg-test"' not in content:
    changed_parts.append("test-package-already-removed")
else:
    print("[WARN] Quick Test Boost block not found in expected form — check src/translations.ts manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_ad_package_pricing.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

ok_fresh = {"prices-updated:3", "test-package-removed"}
ok_rerun = {"prices-already-updated", "test-package-already-removed"}
got = set(changed_parts)

if ok_fresh.issubset(got) or ok_rerun.issubset(got):
    print("[OK] দাম আপডেট হয়েছে (৩০০→১৯৯, ৫০০→৩৯৯, ১০০০→৬৯৯) এবং ৳২০ টেস্ট প্যাকেজ সরানো হয়েছে।")
else:
    print(f"[PARTIAL] চেক করুন: {(ok_fresh - got)}")
