import os
import subprocess

repo = "."

# 1. Find any file that shares a basename with something inside src/
src_files = {}
for root, dirs, files in os.walk(os.path.join(repo, "src")):
    if ".git" in root:
        continue
    for f in files:
        src_files.setdefault(f, []).append(os.path.join(root, f))

duplicates_found = []

for root, dirs, files in os.walk(repo):
    if ".git" in root or "node_modules" in root or root.startswith("./src"):
        continue
    for f in files:
        if f in src_files:
            full = os.path.join(root, f)
            duplicates_found.append((f, full, src_files[f]))

print("===== DUPLICATE FILE NAMES (same name inside src/ AND elsewhere) =====")
if not duplicates_found:
    print("কোনো duplicate পাওয়া যায়নি বাইরে।")
else:
    for name, outside_path, src_paths in duplicates_found:
        print(f"\n[{name}]")
        print(f"  বাইরে (সন্দেহজনক): {outside_path}")
        for sp in src_paths:
            print(f"  আসল (src/): {sp}")

print("\n===== GIT-TRACKED FILES NAMED App.tsx OR AddPartForm.tsx (any location) =====")
try:
    out = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    ).stdout
    for line in out.splitlines():
        base = os.path.basename(line)
        if base in ("App.tsx", "AddPartForm.tsx", "App.jsx"):
            print(" ", line)
except Exception as e:
    print("git ls-files চালাতে সমস্যা হয়েছে:", e)

print("\n===== .py FIX SCRIPTS PILED UP IN ROOT (safe to archive after use) =====")
for f in sorted(os.listdir(repo)):
    if f.startswith("fix_") and f.endswith(".py"):
        print(" ", f)
    if f.startswith("remove_") and f.endswith(".py"):
        print(" ", f)
