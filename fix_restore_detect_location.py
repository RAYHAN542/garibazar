import os

changed_parts = []

path = "src/components/AddPartForm.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''// বিবরণের প্রথম অংশ থেকে একটা সংক্ষিপ্ত শিরোনাম বানায় (কার্ডে দেখানোর জন্য)।
const deriveTitleFromDescription = (text: string): string => {'''

new_block = '''// বিবরণের লেখা থেকে জেলার নাম (ইংরেজি বা বাংলা) খুঁজে বের করে, ফিল্টার সিস্টেমের
// জন্য প্রয়োজনীয় নির্দিষ্ট ফরম্যাটে রিটার্ন করে (যেমন: "Dhaka (ঢাকা)")।
const detectLocationFromText = (text: string): string => {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  for (const city of CITIES) {
    const match = city.match(/^([^(]+)\\(([^)]+)\\)$/);
    if (!match) continue;
    const enName = match[1].trim();
    const bnName = match[2].trim();
    if (bnName && text.includes(bnName)) return city;
    if (enName && lowerText.includes(enName.toLowerCase())) return city;
  }
  // জেলার নাম সরাসরি না পেলে, থানা/উপজেলার নাম (যেমন "বনানী", "ভালুকা") দিয়ে
  // চেষ্টা করে দেখো সেটা কোন জেলার অন্তর্গত।
  const districtFromArea = detectDistrictFromArea(text);
  if (districtFromArea) return districtFromArea;
  return "";
};

// বিবরণের প্রথম অংশ থেকে একটা সংক্ষিপ্ত শিরোনাম বানায় (কার্ডে দেখানোর জন্য)।
const deriveTitleFromDescription = (text: string): string => {'''

if "const detectLocationFromText" in content:
    changed_parts.append("already-present")
elif old_block in content:
    content = content.replace(old_block, new_block, 1)
    changed_parts.append("function-restored")
else:
    print("[WARN] expected anchor (deriveTitleFromDescription) not found — check src/components/AddPartForm.tsx manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_restore_detect_location.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

if "function-restored" in changed_parts or "already-present" in changed_parts:
    print("[OK] detectLocationFromText ফাংশন ফিরিয়ে আনা হয়েছে, Sell form-এর error ঠিক হয়ে গেছে।")
else:
    print("[PARTIAL] ম্যানুয়ালি src/components/AddPartForm.tsx চেক করুন।")
