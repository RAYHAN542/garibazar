path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# --- 1. Import Firestore's atomic increment ---
old0 = """import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, updateDoc, where, addDoc, deleteDoc, limit, startAfter, DocumentSnapshot } from "firebase/firestore";"""
new0 = """import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, updateDoc, where, addDoc, deleteDoc, limit, startAfter, DocumentSnapshot, increment } from "firebase/firestore";"""
if old0 in content:
    content = content.replace(old0, new0, 1)
    changes += 1
    print("[OK] Imported increment()")
else:
    print("[SKIP] Import line not found")

# --- 2. Bring selectedListing back into the fast client-side modal-history handling ---
old1 = """    const isAnyModalOpen = !!(isAuthOpen || promotingListing || editingListing || isRefillModalOpen || isLegalOpen);"""
new1 = """    const isAnyModalOpen = !!(isAuthOpen || selectedListing || promotingListing || editingListing || isRefillModalOpen || isLegalOpen);"""
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("[OK] Re-included selectedListing in modal-history handling")
else:
    print("[SKIP] isAnyModalOpen pattern not found")

old1b = """  }, [isAuthOpen, promotingListing, editingListing, isRefillModalOpen, isLegalOpen]);"""
new1b = """  }, [isAuthOpen, selectedListing, promotingListing, editingListing, isRefillModalOpen, isLegalOpen]);"""
if old1b in content:
    content = content.replace(old1b, new1b, 1)
    changes += 1
    print("[OK] Updated dependency array")
else:
    print("[SKIP] Dependency array pattern not found")

# --- 3. Replace the full-page-reload navigation with instant client-side open + atomic view count ---
old2 = """  // 5. Open the listing detail page via a REAL browser navigation (full URL
  // change), not just a client-side state update. Facebook/Instagram's in-app
  // browser back button ignores purely virtual (pushState-only) history, but
  // it does respect genuine page navigations -- the same way it works on any
  // normal multi-page website. This trades a brief reload for a back button
  // that reliably works.
  const handleViewListingDetails = async (listing: PartListing) => {
    // Fire-and-forget the view counter -- the page is about to navigate away,
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
  };

  // Close the listing detail page the same way it was opened: a real
  // navigation back to the clean home URL, so the "ফিরে যান" button and any
  // future back-button presses land on a genuine, reloadable page.
  const closeListingDetail = () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl;
  };"""

new2 = """  // 5. Open the listing detail page instantly, client-side (no page reload).
  // Shows whatever listing was tapped -- including ones from "Load More" --
  // since it's already in memory. Back button is handled by the modal
  // history effect above (isAnyModalOpen / handlePopState).
  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);

    try {
      const listingRef = doc(db, "listings", listing.id);
      const newViews = (listing.views || 0) + 1;
      await updateDoc(listingRef, { views: increment(1) });
      setListings((prev) =>
        prev.map((item) =>
          item.id === listing.id ? { ...item, views: newViews } : item
        )
      );
      setSelectedListing((prev) =>
        prev && prev.id === listing.id ? { ...prev, views: newViews } : prev
      );
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }
  };

  // Close the listing detail page -- just clear the selection. The modal
  // history effect pops the history entry it pushed when the listing opened.
  const closeListingDetail = () => {
    setSelectedListing(null);
  };"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("[OK] handleViewListingDetails/closeListingDetail now instant, view count atomic")
else:
    print("[SKIP] handleViewListingDetails pattern not found -- check manually")

if changes > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Applied {changes}/4 change(s) to {path}")
    print("       Opening/closing a listing is now instant (no reload),")
    print("       and view counts use Firestore's atomic increment.")
else:
    print("[NOTHING TO DO] No patterns matched -- check manually.")
