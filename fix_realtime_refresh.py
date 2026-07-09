#!/usr/bin/env python3
"""
Fix: Ad boost banner ও view count refresh না করা পর্যন্ত আপডেট হয় না।
Run from inside your project root (garibazar-main/), e.g.:
    python fix_realtime_refresh.py
"""
import re
import sys

path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed = 0

# --- Patch 1: Ad boost success -> actually refresh listings ---
old1 = """          onPromotionSuccess={() => {
            // listing gets updated automatically via listener hook
          }}"""
new1 = """          onPromotionSuccess={() => {
            window.dispatchEvent(new CustomEvent("gari_bazar_refreshed_data"));
          }}"""

if old1 in content:
    content = content.replace(old1, new1)
    changed += 1
    print("[OK] Patch 1 applied: ad boost success now triggers listings refresh")
else:
    print("[SKIP] Patch 1 target not found (maybe already patched)")

# --- Patch 2: View count optimistic local update ---
old2 = """  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);
    
    try {
      const listingRef = doc(db, "listings", listing.id);
      await updateDoc(listingRef, {
        views: (listing.views || 0) + 1
      });
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }
  };"""

new2 = """  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);

    const newViews = (listing.views || 0) + 1;

    // Optimistically patch local state so the UI shows the new count immediately,
    // without waiting for a manual refresh.
    setFirebaseListings((prev) =>
      prev.map((item) => (item.id === listing.id ? { ...item, views: newViews } : item))
    );
    setMoreListings((prev) =>
      prev.map((item) => (item.id === listing.id ? { ...item, views: newViews } : item))
    );

    try {
      const listingRef = doc(db, "listings", listing.id);
      await updateDoc(listingRef, {
        views: newViews
      });
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }
  };"""

if old2 in content:
    content = content.replace(old2, new2)
    changed += 1
    print("[OK] Patch 2 applied: view count now updates locally without refresh")
else:
    print("[SKIP] Patch 2 target not found (maybe already patched)")

if changed == 0:
    print("\nকিছুই পাল্টায়নি — সম্ভবত আগেই প্যাচ করা আছে, অথবা ফাইলের ভার্সন মিলছে না।")
    sys.exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n✅ {changed}/2 patches applied to {path}")
print("এখন git diff চেক করে commit/push করো:")
print("  git diff src/App.tsx")
print("  git add src/App.tsx")
print('  git commit -m "Fix stale ad-boost banner and view count until manual refresh"')
print("  git push")
