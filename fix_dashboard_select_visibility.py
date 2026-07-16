"""
Fix: 'Choose a Posted Car Part' dropdown showed invisible (white-on-white) text
when opened, because:
  1. dark:bg-slate-955 was a typo (invalid Tailwind class, so dark bg never applied)
  2. <option> elements had no explicit color, so mobile browsers rendered them
     with native white background + light text (unreadable)

Run this from the project root (where src/ lives):
    python3 fix_dashboard_select_visibility.py
"""

import re

FILE_PATH = "src/components/DashboardTab.tsx"

OLD_SELECT_CLASS = (
    'className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 '
    'dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 '
    'py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500/30 '
    'font-semibold cursor-pointer"'
)
NEW_SELECT_CLASS = (
    'className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 '
    'dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 '
    'py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500/30 '
    'font-semibold cursor-pointer"'
)

OLD_EMPTY_OPTION = '<option value="">'
NEW_EMPTY_OPTION = '<option value="" className="bg-white text-slate-900">'

OLD_ITEM_OPTION = '<option key={item.id} value={item.id}>'
NEW_ITEM_OPTION = '<option key={item.id} value={item.id} className="bg-white text-slate-900">'


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    changes = 0

    if OLD_SELECT_CLASS in content:
        content = content.replace(OLD_SELECT_CLASS, NEW_SELECT_CLASS, 1)
        changes += 1
    else:
        print("⚠️  select className pattern not found (may already be fixed)")

    if OLD_EMPTY_OPTION in content:
        content = content.replace(OLD_EMPTY_OPTION, NEW_EMPTY_OPTION, 1)
        changes += 1
    else:
        print("⚠️  empty <option> pattern not found (may already be fixed)")

    if OLD_ITEM_OPTION in content:
        content = content.replace(OLD_ITEM_OPTION, NEW_ITEM_OPTION, 1)
        changes += 1
    else:
        print("⚠️  item <option> pattern not found (may already be fixed)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} fix(es) to {FILE_PATH}")


if __name__ == "__main__":
    main()
