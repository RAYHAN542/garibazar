import os

changed_parts = []

path = "src/searchAliases.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''  // Generic vehicle-type terms (English / Bangla variants) - so a plain
  // listing like "গাড়ি বিক্রি হবে" (no brand/model mentioned) is still
  // found by an English "car" search, and vice versa.
  ["car", "গাড়ি", "গারি", "কার"],
  ["truck", "ট্রাক", "লরি", "lorry"],
  ["bus", "বাস"],
  ["bike", "motorcycle", "motorbike", "বাইক", "মোটরসাইকেল", "মোটর সাইকেল"],'''

new_block = '''  // "car" is kept specific (English car <-> বাংলা কার) so a "Car" search
  // shows actual cars, not every truck/excavator listing that happens to
  // use the generic Bangla word "গাড়ি" (vehicle) in its description.
  ["car", "কার"],
  // Generic vehicle-type term (Bangla "গাড়ি"/"গারি" covers any vehicle -
  // car, truck, bus, excavator etc.) - matched against English "vehicle",
  // not "car", to avoid over-matching a specific "car" search.
  ["vehicle", "গাড়ি", "গারি"],
  ["truck", "ট্রাক", "লরি", "lorry"],
  ["bus", "বাস"],
  ["bike", "motorcycle", "motorbike", "বাইক", "মোটরসাইকেল", "মোটর সাইকেল"],'''

if '["car", "কার"],' in content and '["vehicle", "গাড়ি", "গারি"],' in content:
    changed_parts.append("already-patched")
elif old_block in content:
    content = content.replace(old_block, new_block, 1)
    changed_parts.append("alias-split")
else:
    print("[WARN] expected alias block not found in src/searchAliases.ts — check manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_search_car_precision.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

if "alias-split" in changed_parts or "already-patched" in changed_parts:
    print('[OK] "Car" সার্চ এখন শুধু আসল car/কার দেখাবে, generic "গাড়ি" শব্দ থাকা truck/excavator আর আসবে না।')
else:
    print("[PARTIAL] ম্যানুয়ালি src/searchAliases.ts-এর শুরুর দিকের অংশ চেক করুন।")
