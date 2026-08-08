"""
Fix: Dashboard and the Free Boost Lottery only showed as many of a
seller's own posts as had already been paginated into the homepage
feed ("Load More"). A user with many posts, most older than the most
recent 20 site-wide, would see only a partial list in both places.

Fix: fetch the current user's own listings directly from Firestore
(query by sellerId), independent of the homepage's 20-at-a-time feed.
Dashboard and the Lottery product-picker now always show 100% of the
user's own posts, no matter how much of the homepage has been scrolled.

Run this from the project root (where src/ lives):
    python3 fix_dashboard_lottery_missing_posts.py
"""

FILES_CHANGED = []

# ---------------------------------------------------------------------------
# 1. App.tsx
# ---------------------------------------------------------------------------
APP_FILE = "src/App.tsx"

OLD_STATE = '''  const [listings, setListings] = useState<PartListing[]>(getInitialListings);'''
NEW_STATE = '''  const [listings, setListings] = useState<PartListing[]>(getInitialListings);
  // সব পোস্ট: ইউজারের নিজের সব লিস্টিং, হোমপেজের "Load More" পেজিনেশনের ওপর নির্ভর না করে —
  // যাতে Dashboard আর Lottery সবসময় ইউজারের ১০০% পোস্ট দেখাতে পারে, হোমপেজে কত লোড হয়েছে তার তোয়াক্কা না করেই।
  const [myListings, setMyListings] = useState<PartListing[]>([]);'''

OLD_EFFECT_ANCHOR = '''      const unreadForMe = data.unreadCount?.[user.uid] || 0;
        if (unreadForMe > 0) count++;
      });
      setUnreadChatsCount(count);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Paginated Listings Sync (using getDocs instead of global real-time onSnapshot)'''

NEW_EFFECT_ANCHOR = '''      const unreadForMe = data.unreadCount?.[user.uid] || 0;
        if (unreadForMe > 0) count++;
      });
      setUnreadChatsCount(count);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 1b. My Own Listings — সরাসরি sellerId দিয়ে কোয়েরি করা, হোমপেজের ২০-টা পেজিনেটেড লিস্ট থেকে না।
  // এভাবে Dashboard আর Lottery সবসময় ইউজারের আসল ১০০% পোস্ট দেখাবে।
  useEffect(() => {
    if (!user?.uid) {
      setMyListings([]);
      return;
    }
    const q = query(collection(db, "listings"), where("sellerId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PartListing[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : data.createdAt;
        list.push({ id: docSnap.id, ...data, createdAt: normalizedCreatedAt } as PartListing);
      });
      setMyListings(list);
    }, (err) => {
      logger.error("Failed to sync my listings:", err);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Paginated Listings Sync (using getDocs instead of global real-time onSnapshot)'''

OLD_DASHBOARD_PROPS = '''                  isUserAdmin={isUserAdmin}
                  listings={listings}
                  purchases={purchases}'''
NEW_DASHBOARD_PROPS = '''                  isUserAdmin={isUserAdmin}
                  listings={listings}
                  myListings={myListings}
                  purchases={purchases}'''

OLD_LOTTERY_PROPS = '''          userMetadata={userMetadata}
          listings={listings}
          setIsAuthOpen={setIsAuthOpen}
        />
      )}'''
NEW_LOTTERY_PROPS = '''          userMetadata={userMetadata}
          listings={myListings}
          setIsAuthOpen={setIsAuthOpen}
        />
      )}'''

# ---------------------------------------------------------------------------
# 2. DashboardTab.tsx
# ---------------------------------------------------------------------------
DASHBOARD_FILE = "src/components/DashboardTab.tsx"

OLD_PROP_TYPE = '''  listings: PartListing[];
  purchases: any[];'''
NEW_PROP_TYPE = '''  listings: PartListing[];
  myListings: PartListing[];
  purchases: any[];'''

OLD_DESTRUCTURE = '''  listings,
  purchases,'''
NEW_DESTRUCTURE = '''  listings,
  myListings,
  purchases,'''


def apply_fix(path, replacements):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    changed = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            changed += 1
        else:
            print(f"⚠️  a pattern was not found in {path} (may already be fixed)")
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        FILES_CHANGED.append(path)
    return changed


def main():
    n1 = apply_fix(APP_FILE, [
        (OLD_STATE, NEW_STATE),
        (OLD_EFFECT_ANCHOR, NEW_EFFECT_ANCHOR),
        (OLD_DASHBOARD_PROPS, NEW_DASHBOARD_PROPS),
        (OLD_LOTTERY_PROPS, NEW_LOTTERY_PROPS),
    ])

    n2 = apply_fix(DASHBOARD_FILE, [
        (OLD_PROP_TYPE, NEW_PROP_TYPE),
        (OLD_DESTRUCTURE, NEW_DESTRUCTURE),
    ])

    # Bulk-swap every seller-scoped `listings.filter(item => item.sellerId === user.uid`
    # call to use `myListings` instead — but leave the purchases lookup
    # (`listings.find(...)`) and AdminPanel's `listings={listings}` untouched,
    # since those genuinely need the full/global list, not just "my own".
    with open(DASHBOARD_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    old_marker = "listings.filter(item => item.sellerId === user.uid"
    new_marker = "myListings.filter(item => item.sellerId === user.uid"
    count = content.count(old_marker)
    if count:
        content = content.replace(old_marker, new_marker)
        with open(DASHBOARD_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[OK] {DASHBOARD_FILE}: swapped {count} seller-listing filter(s) to use myListings")
        if DASHBOARD_FILE not in FILES_CHANGED:
            FILES_CHANGED.append(DASHBOARD_FILE)
    else:
        print(f"⚠️  {DASHBOARD_FILE}: seller-listing filter pattern not found (may already be fixed)")

    total = n1 + n2 + (1 if count else 0)
    if total == 0:
        print("[SKIP] No changes made — files may already be patched.")
        return

    print(f"\n[OK] Applied fixes across: {', '.join(FILES_CHANGED)}")
    print("Dashboard and Lottery now always show 100% of the user's own posts.")


if __name__ == "__main__":
    main()
