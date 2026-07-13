import re

path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed = False

# 1. Add sessionStartTimeRef next to prevListingsIdRef
old1 = "  const prevListingsIdRef = useRef<Set<string>>(new Set());"
new1 = ("  const prevListingsIdRef = useRef<Set<string>>(new Set());\n"
        "  const sessionStartTimeRef = useRef<number>(Date.now());")
if old1 in content and "sessionStartTimeRef" not in content:
    content = content.replace(old1, new1, 1)
    changed = True

# 2. Guard the notification loop so old listings pulled in by "Load More"
# don't get treated as brand-new posts
old2 = (
    "      const addedListings = listings.filter(l => !prevListingsIdRef.current.has(l.id));\n"
    "      \n"
    "      // Notify for each newly added listing if it's from another seller\n"
    "      addedListings.forEach(newListing => {\n"
    "        if (newListing.sellerId !== user?.uid) {"
)
new2 = (
    "      const addedListings = listings.filter(l => !prevListingsIdRef.current.has(l.id));\n"
    "      \n"
    "      // Notify for each newly added listing if it's from another seller\n"
    "      // AND it was actually created after this session started (prevents Load More\n"
    "      // pagination from re-triggering notifications for old, already-existing listings)\n"
    "      addedListings.forEach(newListing => {\n"
    "        const createdAtMs = newListing.createdAt ? new Date(newListing.createdAt).getTime() : 0;\n"
    "        if (createdAtMs <= sessionStartTimeRef.current) return;\n"
    "        if (newListing.sellerId !== user?.uid) {"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    changed = True
elif "sessionStartTimeRef.current) return;" in content:
    pass  # already patched
else:
    print("[WARN] notification loop প্যাটার্ন মিলেনি, ম্যানুয়ালি চেক করো।")

if changed:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] App.tsx: patched (Load More আর old listing এর জন্য fake 'new post' notification পাঠাবে না)")
else:
    print("[SKIP] কোনো পরিবর্তন হয়নি — হয়তো আগেই প্যাচ করা আছে।")
