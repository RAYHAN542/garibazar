"""
Fix: Searching for something specific (e.g. "Truck") was returning
completely unrelated listings (a sedan, an SUV) mixed into the results.

Root cause: the fuzzy-match fallback (Fuse.js) was matching against a
broad "search blob" field that includes generic category labels like
"Vehicle" / "গাড়ি ও যানবাহন", combined with a fairly loose match
threshold (0.4). That combination let queries loosely match almost any
vehicle listing, not just ones actually related to the search term.

Fix: the fuzzy fallback now only matches against title and model (the
precise fields), dropping the noisy category-label blob from fuzzy
matching, and the threshold is tightened from 0.4 to 0.3. The precise
direct-substring matching phase (which already searches the full blob
for exact matches) is untouched — this only affects the fuzzy/typo-
tolerant fallback layer.

Run this from the project root (where src/ lives):
    python3 fix_search_relevance.py
"""

FILE_PATH = "src/App.tsx"

OLD_BLOCK = '''  const fuseInstance = useMemo(() => {
    return new Fuse(enrichedListings, {
      keys: [
        { name: "title", weight: 0.4 },
        { name: "model", weight: 0.3 },
        { name: "searchBlob", weight: 0.3 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }, [enrichedListings]);'''

NEW_BLOCK = '''  const fuseInstance = useMemo(() => {
    return new Fuse(enrichedListings, {
      keys: [
        { name: "title", weight: 0.6 },
        { name: "model", weight: 0.4 }
      ],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }, [enrichedListings]);'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_BLOCK not in content:
        print("[SKIP] Pattern not found — file may already be patched.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Tightened fuzzy search matching in {FILE_PATH}")


if __name__ == "__main__":
    main()
