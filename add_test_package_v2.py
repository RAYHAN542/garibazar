FILE_PATH = "src/translations.ts"
MARKER = "export const AD_PACKAGES: AdPackage[] = ["

NEW_PACKAGE = '''  {
    id: "pkg-test",
    nameEn: "Quick Test Boost",
    nameBn: "কুইক টেস্ট বুস্ট",
    price: 20,
    durationDays: 1,
    benefitsEn: [
      "For payment gateway testing only",
      "Displays Promoted badge for 1 day"
    ],
    benefitsBn: [
      "শুধুমাত্র পেমেন্ট টেস্টিং-এর জন্য",
      "১ দিনের জন্য Promoted ব্যাজ দেখাবে"
    ],
    tier: "basic"
  },
'''

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

if MARKER not in content:
    print("ERROR: marker not found, aborting.")
    raise SystemExit(1)

if 'id: "pkg-test"' in content:
    print("Already added, skipping.")
    raise SystemExit(0)

content = content.replace(MARKER, MARKER + "\n" + NEW_PACKAGE, 1)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Added pkg-test package successfully.")
