"""
Removes verified-unused named imports (icons, helpers, etc.) that have
piled up in the codebase over many rounds of feature add/remove.

Every name below was confirmed to appear ONLY in its own import
statement anywhere in the file (i.e. truly never used in JSX/code).

Run this from the project root (where src/ lives):
    python3 remove_unused_imports.py
"""

import re

FILES_TO_FIX = {
    "src/App.tsx": [
        "Sparkles", "Plus", "MapPin", "Tag", "History", "TrendingUp", "Eye",
        "SquarePlay", "Grid", "Heart", "ShieldAlert", "Zap", "Coins", "Copy",
        "X", "Star", "CheckCircle2", "Trash2", "SquarePen", "Share2", "Bell",
        "Gift", "Wrench", "RotateCw", "Truck", "CITIES", "PromotedSlider",
        "MessageSquare", "Cpu", "SlidersHorizontal", "ChevronDown", "Lock",
        "CreditCard",
    ],
    "src/components/AdminPanel.tsx": ["Phone", "ArrowRight"],
    "src/components/ChatView.tsx": ["Phone"],
    "src/components/DataDeletionPage.tsx": ["ShieldAlert"],
    "src/components/ListingDetailModal.tsx": ["Eye", "Heart", "RotateCcw", "Calendar"],
    "src/components/PlayStoreDiagnostics.tsx": [
        "ShieldCheck", "HardDrive", "Signal", "HelpCircle", "Pocket", "Layout",
    ],
    "src/components/PrivacyPolicyPage.tsx": ["FileText"],
    "src/components/PromoteAdModal.tsx": ["Sparkles"],
    "src/components/RefillModal.tsx": ["validatePriceInput"],
    "src/components/SellerAnalyticsGraph.tsx": ["ArrowUpRight", "TrendingDown"],
    "src/components/SimulatedPaymentPortal.tsx": [
        "Smartphone", "ChevronRight", "CreditCard", "ArrowLeft", "Heart",
    ],
}

IMPORT_RE = re.compile(
    r'import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+([\'"][^\'"]+[\'"]);?'
)


def process_file(path, names_to_remove):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    names_set = set(names_to_remove)
    removed_here = set()

    def replacer(m):
        names_raw, module = m.group(1), m.group(2)
        items = [p.strip() for p in names_raw.split(",") if p.strip()]
        kept = []
        for item in items:
            # local binding name (handles "type X" and "X as Y")
            clean = item.replace("type ", "")
            local = clean.split(" as ")[-1].strip()
            if local in names_set:
                removed_here.add(local)
                continue
            kept.append(item)
        if not kept:
            return ""  # drop the whole import line
        return f"import {{ {', '.join(kept)} }} from {module};"

    new_content = IMPORT_RE.sub(replacer, content)
    # clean up any now-empty lines left behind by fully-dropped imports
    new_content = re.sub(r'\n[ \t]*\n[ \t]*\n', '\n\n', new_content)

    if new_content != content:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)

    missing = names_set - removed_here
    return removed_here, missing


def main():
    total_removed = 0
    for path, names in FILES_TO_FIX.items():
        removed, missing = process_file(path, names)
        if removed:
            print(f"[OK] {path}: removed {len(removed)} unused import(s) -> {', '.join(sorted(removed))}")
            total_removed += len(removed)
        if missing:
            print(f"⚠️  {path}: could not find {', '.join(sorted(missing))} (already fixed or file changed)")

    print(f"\nTotal unused imports removed: {total_removed}")


if __name__ == "__main__":
    main()
