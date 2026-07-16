path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# --- 1. Speed up the deep-link opening effect ---
old1 = """  // Open a specific listing when arriving via a shared link (?listing=<id>).
  // Only runs once per page load, and only after the target listing has actually loaded in.
  const [hasOpenedSharedListing, setHasOpenedSharedListing] = useState(false);
  useEffect(() => {
    if (hasOpenedSharedListing) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedListingId = params.get("listing");
    if (!sharedListingId) return;

    const target = listings.find((item) => item.id === sharedListingId);
    if (target) {
      setSelectedListing(target);
      setHasOpenedSharedListing(true);
      // Clean the URL so re-opening/closing the modal doesn't re-trigger this
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [listings, hasOpenedSharedListing]);
"""

new1 = """  // Open a specific listing when arriving via a shared link (?listing=<id>)
  // or via our own real-navigation listing open. Runs once per page load.
  //
  // Speed: instead of waiting for the ENTIRE listings collection to sync down
  // before we can find this one item (slow, especially on weak connections),
  // we try two much faster paths first:
  //   1. A locally cached copy stashed right before we navigated here (instant,
  //      zero network wait).
  //   2. A direct single-document fetch by ID (one small request, instead of
  //      syncing the whole marketplace).
  // The full `listings` collection still loads in the background as normal.
  const [hasOpenedSharedListing, setHasOpenedSharedListing] = useState(false);
  useEffect(() => {
    if (hasOpenedSharedListing) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sharedListingId = params.get("listing");
    if (!sharedListingId) return;

    setHasOpenedSharedListing(true);
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;

    // Fastest path: a cached copy of this exact listing from just before we navigated.
    try {
      const cachedRaw = sessionStorage.getItem("gari_bazar_cached_listing");
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.id === sharedListingId) {
          setSelectedListing(cached);
          sessionStorage.removeItem("gari_bazar_cached_listing");
          window.history.replaceState({}, "", cleanUrl);
          return;
        }
      }
    } catch {}

    // Next fastest: an already-loaded local match, if the collection happened
    // to sync down before this effect ran.
    const target = listings.find((item) => item.id === sharedListingId);
    if (target) {
      setSelectedListing(target);
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    // Last resort: fetch just this one document directly.
    (async () => {
      try {
        const snap = await getDoc(doc(db, "listings", sharedListingId));
        if (snap.exists()) {
          setSelectedListing({ id: snap.id, ...snap.data() } as PartListing);
        }
      } catch (err) {
        console.warn("Could not fetch shared listing directly:", err);
      } finally {
        window.history.replaceState({}, "", cleanUrl);
      }
    })();
  }, [listings, hasOpenedSharedListing]);
"""

if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("[OK] Deep-link listing effect now uses cache + direct fetch (much faster)")
else:
    print("[SKIP] Deep-link effect pattern not found -- check manually")

# --- 2. Stash the listing before navigating, in handleViewListingDetails ---
old2 = """    // Fire-and-forget the view counter -- the page is about to navigate away,
    // so we don't wait for this to finish.
    try {
      const listingRef = doc(db, "listings", listing.id);
      updateDoc(listingRef, { views: (listing.views || 0) + 1 }).catch(() => {});
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }

    const url = `${window.location.origin}${window.location.pathname}?listing=${encodeURIComponent(listing.id)}`;
    window.location.href = url;
  };"""

new2 = """    // Fire-and-forget the view counter -- the page is about to navigate away,
    // so we don't wait for this to finish.
    try {
      const listingRef = doc(db, "listings", listing.id);
      updateDoc(listingRef, { views: (listing.views || 0) + 1 }).catch(() => {});
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }

    // Stash the listing data we already have in memory so the next page load
    // can show it instantly, without waiting on any network request.
    try {
      sessionStorage.setItem("gari_bazar_cached_listing", JSON.stringify(listing));
    } catch {}

    const url = `${window.location.origin}${window.location.pathname}?listing=${encodeURIComponent(listing.id)}`;
    window.location.href = url;
  };"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("[OK] handleViewListingDetails now caches the listing before navigating")
else:
    print("[SKIP] handleViewListingDetails pattern not found -- check manually")

if changes > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Applied {changes}/2 change(s) to {path}")
    print("       Opening a listing should now feel near-instant instead of waiting")
    print("       for the whole marketplace to sync down first.")
else:
    print("[NOTHING TO DO] No patterns matched -- check manually.")
