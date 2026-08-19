"""
Improvement: When someone types a search query, the app now automatically
fetches many more listings in the background (up to 500 extra, in batches
of 100), instead of only searching whatever had already been manually
paginated in via "Load More". This means search results are almost
always complete at the app's current scale, without the person needing
to repeatedly tap "Load More" to find older matching posts.

(For very large scale in the future — many thousands of listings — a
proper server-side search service like Algolia or Typesense would be
the more robust long-term solution, but this covers the current need
without adding a third-party dependency.)

Run this from the project root (where src/ lives):
    python3 fix_search_autoload_more.py
"""

FILE_PATH = "src/App.tsx"

OLD_ANCHOR = '''  // 2c. Listings Pagination Loader helper'''

NEW_BLOCK = '''  // 2d. সার্চ করার সময় ব্যাকগ্রাউন্ডে বড় ব্যাচে সব পোস্ট এনে ফেলা — যাতে "Load More" বারবার
  // চাপা না লাগে, সার্চের রেজাল্ট প্রায় সবসময় সম্পূর্ণ থাকে (বর্তমান স্কেলে যথেষ্ট)।
  useEffect(() => {
    if (!searchQuery.trim()) return;
    if (!hasMoreListings) return; // সব পোস্ট ইতিমধ্যে লোড হয়ে গেছে

    let cancelled = false;
    const timer = setTimeout(async () => {
      let currentLastDoc = lastListingDoc;
      const MAX_BATCHES = 5; // সর্বোচ্চ ৫ × ১০০ = ৫০০ অতিরিক্ত পোস্ট আনা হবে
      for (let i = 0; i < MAX_BATCHES && !cancelled && currentLastDoc; i++) {
        try {
          const q = query(
            collection(db, "listings"),
            orderBy("createdAt", "desc"),
            startAfter(currentLastDoc),
            limit(100)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            setHasMoreListings(false);
            break;
          }
          const nextList: PartListing[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === "function"
              ? data.createdAt.toDate().toISOString()
              : data.createdAt;
            nextList.push({ id: doc.id, ...data, createdAt: normalizedCreatedAt } as PartListing);
          });

          setMoreListings(prev => {
            const combined = [...prev];
            nextList.forEach(item => {
              if (!combined.some(existing => existing.id === item.id)) {
                combined.push(item);
              }
            });
            return combined;
          });

          currentLastDoc = snapshot.docs[snapshot.docs.length - 1];
          setLastListingDoc(currentLastDoc);

          if (snapshot.docs.length < 100) {
            setHasMoreListings(false);
            break;
          }
        } catch (err) {
          console.warn("Failed to prefetch listings for search:", err);
          break;
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, hasMoreListings]);

  // 2c. Listings Pagination Loader helper'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if OLD_ANCHOR not in content:
        print("[SKIP] Anchor not found — file may already be patched.")
        return

    if NEW_BLOCK in content:
        print("[SKIP] Already patched.")
        return

    content = content.replace(OLD_ANCHOR, NEW_BLOCK, 1)

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Added search auto-prefetch effect to {FILE_PATH}")


if __name__ == "__main__":
    main()
