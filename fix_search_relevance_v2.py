"""
Follow-up fix to the search-relevance patch: the previous fix removed
description text entirely from fuzzy matching, only searching title and
model. But since titles/models are auto-generated from just the first
line of the description (see AddPartForm.tsx's deriveTitleFromDescription),
that meant real details written later in a listing's description became
unsearchable via the fuzzy fallback.

This fix restores description to fuzzy search, but through a clean,
separate field (fuzzyBlob) that excludes the generic category-label
text (like "Vehicle") that was causing the original false-positive
matches (e.g. "Truck" matching a sedan). Precise details in the
description stay searchable; generic category noise stays excluded.

Run this from the project root (where src/ lives), AFTER
fix_search_relevance.py has already been applied:
    python3 fix_search_relevance_v2.py
"""

FILE_PATH = "src/App.tsx"

OLD_BLOCK = '''  const enrichedListings = useMemo(() => {
    return listingsWithAds.map((item) => {
      const cat = CATEGORIES.find(c => c.id === item.category);
      const categoryLabelEn = cat ? cat.labelEn : "";
      const categoryLabelBn = cat ? cat.labelBn : "";
      
      const searchBlob = buildSearchBlob([
        item.title,
        item.brand || "",
        item.model,
        item.description,
        item.category,
        categoryLabelEn,
        categoryLabelBn,
        item.location
      ]);
      
      return {
        ...item,
        searchBlob
      };
    });
  }, [listingsWithAds]);

  const fuseInstance = useMemo(() => {
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

NEW_BLOCK = '''  const enrichedListings = useMemo(() => {
    return listingsWithAds.map((item) => {
      const cat = CATEGORIES.find(c => c.id === item.category);
      const categoryLabelEn = cat ? cat.labelEn : "";
      const categoryLabelBn = cat ? cat.labelBn : "";
      
      const searchBlob = buildSearchBlob([
        item.title,
        item.brand || "",
        item.model,
        item.description,
        item.category,
        categoryLabelEn,
        categoryLabelBn,
        item.location
      ]);

      // ফাজি সার্চের জন্য আলাদা, পরিষ্কার ব্লব — টাইটেল/মডেল যেহেতু description থেকেই
      // অটো-জেনারেট হয় (শুধু প্রথম লাইন), তাই পুরো description এখানে রাখা জরুরি, কিন্তু
      // ক্যাটাগরি লেবেলের মতো generic টেক্সট (যেমন "Vehicle") বাদ দেওয়া হয়েছে —
      // ওটাই ভুল ম্যাচ (যেমন "Truck" সার্চে সব গাড়ি চলে আসা) তৈরি করছিল।
      const fuzzyBlob = buildSearchBlob([
        item.title,
        item.brand || "",
        item.model,
        item.description
      ]);
      
      return {
        ...item,
        searchBlob,
        fuzzyBlob
      };
    });
  }, [listingsWithAds]);

  const fuseInstance = useMemo(() => {
    return new Fuse(enrichedListings, {
      keys: [
        { name: "title", weight: 0.5 },
        { name: "model", weight: 0.2 },
        { name: "fuzzyBlob", weight: 0.3 }
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
        print("[SKIP] Pattern not found — file may already be patched, or fix_search_relevance.py wasn't applied yet.")
        return

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Restored description to fuzzy search (via clean fuzzyBlob) in {FILE_PATH}")


if __name__ == "__main__":
    main()
