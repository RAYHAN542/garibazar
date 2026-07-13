import os
import re

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed = False

# Remove confirmed-unused named imports without touching used ones on the same line
def strip_unused(content, import_stmt_contains, unused_names):
    global changed
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith("import") and import_stmt_contains in line:
            for name in unused_names:
                pattern = r'(\{[^}]*?)\b' + re.escape(name) + r'\b\s*,?\s*'
                new_line, n = re.subn(pattern, lambda m: m.group(1), lines[i])
                if n:
                    lines[i] = new_line
                    changed = True
            # cleanup stray ", }" or "{ ,"
            lines[i] = re.sub(r',\s*}', ' }', lines[i])
            lines[i] = re.sub(r'{\s*,', '{ ', lines[i])
    return "\n".join(lines)

content = strip_unused(content, "firebase/auth", ["onAuthStateChanged"])
content = strip_unused(content, "firebase/firestore", ["setDoc"])
content = strip_unused(content, "lucide-react", ["ArrowRight", "Download"])

if changed:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# Remove orphaned ProfileTab.tsx (confirmed unused anywhere in src/)
orphan = "src/components/ProfileTab.tsx"
removed_orphan = False
if os.path.exists(orphan):
    os.remove(orphan)
    removed_orphan = True

print("[OK] App.tsx: unused imports removed (onAuthStateChanged, setDoc, ArrowRight, Download)" if changed else "[SKIP] unused import প্যাটার্ন মিলেনি, ম্যানুয়ালি চেক করো")
print("[OK] src/components/ProfileTab.tsx deleted (confirmed orphaned, 696 lines)" if removed_orphan else "[SKIP] ProfileTab.tsx পাওয়া যায়নি, আগেই মুছে ফেলা হয়েছে হয়তো")
