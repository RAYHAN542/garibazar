with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    (
        'className={`relative overflow-hidden rounded-2xl p-3.5 flex flex-col text-left cursor-pointer bg-gradient-to-br from-amber-50 to-amber-100 dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${',
        'className={`relative overflow-hidden rounded-2xl p-3 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${'
    ),
    (
        'className={`relative overflow-hidden rounded-2xl p-3.5 flex flex-col text-left cursor-pointer bg-gradient-to-br from-sky-50 to-sky-100 dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${',
        'className={`relative overflow-hidden rounded-2xl p-3 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${'
    ),
    (
        'className="text-[10px] font-bold text-amber-700/70 dark:text-amber-400/70 leading-snug mt-1 mb-3"',
        'className="text-[10px] font-bold text-amber-700/70 dark:text-amber-400/70 leading-snug mt-1 mb-2"'
    ),
    (
        'className="text-[10px] font-bold text-sky-700/70 dark:text-sky-400/70 leading-snug mt-1 mb-3"',
        'className="text-[10px] font-bold text-sky-700/70 dark:text-sky-400/70 leading-snug mt-1 mb-2"'
    ),
    (
        'className="w-full h-20 object-contain mt-auto"',
        'className="w-full h-16 object-contain mt-auto"'
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
