"""
Fix: In the Admin Panel, the "Visitors & Logins" tab (to the right of
"Support Tickets") was invisible and unreachable. The tab bar had 5 buttons
but no horizontal scrolling enabled, so on phone screens the row overflowed
and the last tab got clipped outside the visible area — swiping did nothing
because overflow-x wasn't turned on.

Fix: enable horizontal scroll on the tab bar, and stop the buttons from
shrinking/wrapping so each stays fully readable while scrolling.

Run this from the project root (where src/ lives):
    python3 fix_admin_tabs_visitor_button.py
"""

FILE_PATH = "src/components/AdminPanel.tsx"

REPLACEMENTS = [
    (
        '<div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 pt-1">\n        <button\n          onClick={() => setAdminSubTab("requests")}',
        '<div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 pt-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">\n        <button\n          onClick={() => setAdminSubTab("requests")}',
    ),
    (
        'onClick={() => setAdminSubTab("requests")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${\n            adminSubTab === "requests"',
        'onClick={() => setAdminSubTab("requests")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${\n            adminSubTab === "requests"',
    ),
    (
        'onClick={() => setAdminSubTab("listings")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${\n            adminSubTab === "listings"',
        'onClick={() => setAdminSubTab("listings")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${\n            adminSubTab === "listings"',
    ),
    (
        'onClick={() => setAdminSubTab("settings")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${\n            adminSubTab === "settings"',
        'onClick={() => setAdminSubTab("settings")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${\n            adminSubTab === "settings"',
    ),
    (
        'onClick={() => setAdminSubTab("tickets")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${\n            adminSubTab === "tickets"',
        'onClick={() => setAdminSubTab("tickets")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${\n            adminSubTab === "tickets"',
    ),
    (
        'onClick={() => setAdminSubTab("analytics")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${\n            adminSubTab === "analytics"',
        'onClick={() => setAdminSubTab("analytics")}\n          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${\n            adminSubTab === "analytics"',
    ),
]


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changes = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new, 1)
            changes += 1
        else:
            print("⚠️  a pattern was not found (may already be fixed)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} fix(es) to {FILE_PATH}")
    print("Admin sub-tab bar now scrolls horizontally — 'Visitors & Logins' tab is reachable.")


if __name__ == "__main__":
    main()
