"""
Fix: The boosted-ad banner (FEATURED slider) on the homepage stayed
empty until the person clicked "Load More" — because it only pulled
from whatever had been paginated into the homepage feed so far (20
items at a time). If none of the currently-boosted ads happened to be
in that first batch, the banner showed nothing.

Fix: fetch all currently-boosted listings (isAd: true) directly from
Firestore, independent of homepage pagination — same pattern used
earlier for "my own listings". This complete ad list is merged into
the base listings before category/search filtering, so:
  - The ad banner always shows live boosted ads immediately on load.
  - Category/search filtering still applies correctly (a boosted
    vehicle still won't show while browsing "Vehicle Parts", etc.)
  - The ad-expiry checker also now scans this complete list instead
    of the paginated one, so expired ads get reset reliably too.

Run this from the project root (where src/ lives):
    python3 fix_ad_banner_pagination.py
"""

FILE_PATH = "src/App.tsx"

REPLACEMENTS = [
    (
        '''  const [myListings, setMyListings] = useState<PartListing[]>([]);''',
        '''  const [myListings, setMyListings] = useState<PartListing[]>([]);
  // সব বুস্ট করা অ্যাড: হোমপেজের পেজিনেশনের ওপর নির্ভর না করে সরাসরি fetch করা,
  // যাতে "Load More" চাপার আগেই সবসময় বুস্ট ব্যানার দেখা যায়।
  const [adListings, setAdListings] = useState<PartListing[]>([]);''',
    ),
    (
        '''      setMyListings(list);
    }, (err) => {
      logger.error("Failed to sync my listings:", err);
    });
    return () => unsubscribe();
  }, [user?.uid]);''',
        '''      setMyListings(list);
    }, (err) => {
      logger.error("Failed to sync my listings:", err);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 1c. সব লাইভ বুস্ট করা অ্যাড — হোমপেজের "Load More" পেজিনেশনের ওপর নির্ভর না করে সরাসরি fetch করা,
  // যাতে পেজ লোড হওয়ার সাথে সাথেই বুস্ট ব্যানার দেখা যায়, Load More চাপার আগেই।
  useEffect(() => {
    const q = query(collection(db, "listings"), where("isAd", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PartListing[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : data.createdAt;
        list.push({ id: docSnap.id, ...data, createdAt: normalizedCreatedAt } as PartListing);
      });
      setAdListings(list);
    }, (err) => {
      logger.error("Failed to sync ad listings:", err);
    });
    return () => unsubscribe();
  }, []);''',
    ),
    (
        '''  const enrichedListings = useMemo(() => {
    return listings.map((item) => {
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
  }, [listings]);''',
        '''  // পেজিনেটেড হোমপেজ ফিড + সব লাইভ বুস্ট করা অ্যাড — একসাথে merge করা (duplicate বাদ দিয়ে),
  // যাতে category/search filter সবসময় ঠিকভাবে কাজ করে আর বুস্ট ব্যানারও সবসময় দেখা যায়।
  const listingsWithAds = useMemo(() => {
    const merged = [...listings];
    const existingIds = new Set(listings.map((item) => item.id));
    for (const adItem of adListings) {
      if (!existingIds.has(adItem.id)) {
        merged.push(adItem);
      }
    }
    return merged;
  }, [listings, adListings]);

  const enrichedListings = useMemo(() => {
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
  }, [listingsWithAds]);''',
    ),
    (
        '''  // 3b. Expired Ad Promotion Resetter & Delete / Edit Helpers
  useEffect(() => {
    if (listings.length === 0) return;
    
    // Check if any listings contains an expired advertisement
    const expiredAds = listings.filter(
      (item) => item.isAd && item.adExpiresAt && new Date(item.adExpiresAt).getTime() < Date.now()
    );''',
        '''  // 3b. Expired Ad Promotion Resetter & Delete / Edit Helpers
  useEffect(() => {
    if (adListings.length === 0) return;
    
    // Check if any listings contains an expired advertisement
    const expiredAds = adListings.filter(
      (item) => item.isAd && item.adExpiresAt && new Date(item.adExpiresAt).getTime() < Date.now()
    );''',
    ),
]

# The dependency array `}, [listings]);` appears more than once in the file,
# so it's handled separately below by locating the one right after the
# expired-ad-resetter block (identified by the preceding catch block text).
DEP_ARRAY_ANCHOR_OLD = '''          console.error("Error resetting expired advertisement promotion:", err);
        }
      });
    }
  }, [listings]);'''

DEP_ARRAY_ANCHOR_NEW = '''          console.error("Error resetting expired advertisement promotion:", err);
        }
      });
    }
  }, [adListings]);'''


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

    if DEP_ARRAY_ANCHOR_OLD in content:
        content = content.replace(DEP_ARRAY_ANCHOR_OLD, DEP_ARRAY_ANCHOR_NEW, 1)
        changes += 1
    else:
        print("⚠️  dependency array anchor not found (may already be fixed)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} fix(es) to {FILE_PATH}")
    print("Ad banner now shows immediately on load, and expiry-checking is reliable regardless of pagination.")


if __name__ == "__main__":
    main()
