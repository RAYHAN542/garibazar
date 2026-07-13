import re
import subprocess

path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()
content = "".join(lines)

print("===== ১. UNUSED IMPORTS (src/App.tsx) =====")
import_block = []
for i, line in enumerate(lines[:80]):
    m = re.match(r'^\s*import\s+\{([^}]+)\}\s+from', line)
    if m:
        names = [n.strip().split(" as ")[0].strip() for n in m.group(1).split(",") if n.strip()]
        for name in names:
            # count occurrences outside the import line itself
            uses = len(re.findall(r'\b' + re.escape(name) + r'\b', content))
            if uses <= 1:
                import_block.append((name, i + 1))
if import_block:
    for name, ln in import_block:
        print(f"  Line {ln}: '{name}' — শুধু import-এই আছে, আর কোথাও ব্যবহার হয়নি")
else:
    print("  কিছু পাওয়া যায়নি (বা regex simple import-only ধরতে পারেনি)")

print("\n===== ২. SAMPLE_LISTINGS / MOCK DATA রেফারেন্স =====")
for i, line in enumerate(lines):
    if "SAMPLE_LISTINGS" in line or "mockReviews" in line or "MOCK_" in line:
        print(f"  Line {i+1}: {line.strip()[:90]}")

print("\n===== ৩. console.log / console.warn (production-এ রাখা ঠিক না) =====")
count = 0
for i, line in enumerate(lines):
    if "console.log(" in line:
        count += 1
        if count <= 15:
            print(f"  Line {i+1}: {line.strip()[:90]}")
print(f"  মোট console.log পাওয়া গেছে: {count}" + (" (উপরে প্রথম ১৫টা দেখানো হলো)" if count > 15 else ""))

print("\n===== ৪. TODO / FIXME / temporary মার্ক করা কোড =====")
for i, line in enumerate(lines):
    if re.search(r'TODO|FIXME|HACK|XXX|temporary|temp fix', line, re.IGNORECASE):
        print(f"  Line {i+1}: {line.strip()[:90]}")

print("\n===== ৫. .tsx/.ts ফাইল যেগুলো কোথাও import হয়নি (orphaned components) =====")
import glob
tracked = []
try:
    out = subprocess.run(["git", "ls-files", "src/components/"], capture_output=True, text=True, check=True).stdout
    tracked = out.splitlines()
except Exception:
    tracked = glob.glob("src/components/**/*.tsx", recursive=True) + glob.glob("src/components/**/*.ts", recursive=True)

for f in tracked:
    if not (f.endswith(".tsx") or f.endswith(".ts")):
        continue
    basename = f.split("/")[-1].rsplit(".", 1)[0]
    grep = subprocess.run(["grep", "-rl", basename, "src/", "--include=*.tsx", "--include=*.ts"], capture_output=True, text=True).stdout
    importers = [l for l in grep.splitlines() if l != f]
    if not importers:
        print(f"  {f} — এই কম্পোনেন্ট আর কোথাও import হয় না, সম্ভবত orphaned/dead")

print("\n===== ৬. root-এ ভুল জায়গায় থাকা ফাইল (আবার চেক) =====")
import os
for f in sorted(os.listdir(".")):
    if f.endswith((".tsx", ".jsx")) and os.path.isfile(f):
        print(f"  ./{f} — root-এ TSX ফাইল, এখানে থাকার কথা না (src/-এ থাকা উচিত)")

print("\n===== শেষ — এই লিস্ট শুধু তথ্যের জন্য, কিছু ডিলেট করা হয়নি =====")
