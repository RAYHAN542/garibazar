path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# --- 1. Exclude selectedListing from the virtual pushState modal trick ---
old1 = """    const isAnyModalOpen = !!(isAuthOpen || selectedListing || promotingListing || editingListing || isRefillModalOpen || isLegalOpen);"""
new1 = """    const isAnyModalOpen = !!(isAuthOpen || promotingListing || editingListing || isRefillModalOpen || isLegalOpen);"""
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("[OK] Excluded selectedListing from the virtual modal-history trick")
else:
    print("[SKIP] isAnyModalOpen pattern not found")

old1b = """  }, [isAuthOpen, selectedListing, promotingListing, editingListing, isRefillModalOpen, isLegalOpen]);"""
new1b = """  }, [isAuthOpen, promotingListing, editingListing, isRefillModalOpen, isLegalOpen]);"""
if old1b in content:
    content = content.replace(old1b, new1b, 1)
    changes += 1
    print("[OK] Updated the effect's dependency array")
else:
    print("[SKIP] Dependency array pattern not found")

# --- 2. Replace handleViewListingDetails with a real-navigation version ---
old2 = """  // 5. Track views asynchronously when user reviews details
  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);
    
    try {
      const listingRef = doc(db, "listings", listing.id);
      const newViews = (listing.views || 0) + 1;
      await updateDoc(listingRef, {
        views: newViews
      });
      // Reflect the new view count immediately in local state so the
      // updated number shows right away without needing an app reload.
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

  // 6. Sign out trigger"""

new2 = """  // 5. Open the listing detail page via a REAL browser navigation (full URL
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

    const url = `${window.location.origin}${window.location.pathname}?listing=${encodeURIComponent(listing.id)}`;
    window.location.href = url;
  };

  // Close the listing detail page the same way it was opened: a real
  // navigation back to the clean home URL, so the "ফিরে যান" button and any
  // future back-button presses land on a genuine, reloadable page.
  const closeListingDetail = () => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl;
  };

  // 6. Sign out trigger"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("[OK] handleViewListingDetails now does a real navigation; added closeListingDetail()")
else:
    print("[SKIP] handleViewListingDetails pattern not found")

# --- 3. Wire the modal's back button to the new real-navigation close ---
old3 = """          onClose={() => setSelectedListing(null)}"""
new3 = """          onClose={closeListingDetail}"""
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("[OK] Listing modal's onClose now uses closeListingDetail()")
else:
    print("[SKIP] onClose pattern not found")

if changes > 0:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[DONE] Applied {changes}/4 change(s) to {path}")
    print("       Opening/closing a listing is now a real page navigation.")
else:
    print("[NOTHING TO DO] No patterns matched -- check manually.")
