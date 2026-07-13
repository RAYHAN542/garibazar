import re

path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = "reduce((sum, current) => sum + (current.views ?? 0), 0) + 18}"
new = "reduce((sum, current) => sum + (current.views ?? 0), 0)}"

if old not in content:
    print("না, প্যাটার্ন মিলেনি। ম্যানুয়ালি চেক করো লাইন ২৩৭৪।")
else:
    content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] App.tsx: patched (removed fake +18 padding from Shop Views count)")
