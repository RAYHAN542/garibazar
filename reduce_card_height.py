with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        'className="w-full h-auto max-h-32 object-contain mt-auto"',
        'className="w-full h-auto max-h-24 object-contain mt-auto"'
    ),
    (
        'className={`relative overflow-hidden rounded-2xl p-3 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${',
        'className={`relative overflow-hidden rounded-2xl p-2.5 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${'
    ),
]

missing = []
for old, new in replacements:
    count = content.count(old)
    if count == 0:
        missing.append(old[:60])
    else:
        content = content.replace(old, new)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

if missing:
    print("NOT FOUND (check manually):")
    for m in missing:
        print(" -", m)
else:
    print("All patterns matched and replaced successfully.")
