path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = "  }, [isAuthOpen, selectedListing, promotingListing]);"
new = "  }, [isAuthOpen, selectedListing, promotingListing, editingListing, isRefillModalOpen, isLegalOpen]);"

if old in content:
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] App.tsx: patched (back-button/modal handler now tracks ALL modals correctly)")
else:
    print("[SKIP] প্যাটার্ন মিলেনি — হয়তো আগেই ঠিক করা আছে, ম্যানুয়ালি চেক করো।")
