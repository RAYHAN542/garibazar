"""
Update: The boosted-ad banner previously only showed ads matching the
CURRENTLY SELECTED category (e.g. a boosted vehicle wouldn't show while
browsing "Vehicle Parts", and vice versa). This confused sellers who
paid to boost a listing but couldn't find it — since it only appeared
on one specific tab.

Now the banner shows ALL currently-live boosted ads (both vehicles and
parts) on every tab, regardless of category/search filters, so anyone
who boosts a listing can always see it working immediately.

Run this from the project root (where src/ lives):
    python3 fix_ad_banner_show_all_categories.py
"""

FILES_CHANGED = []

# ---------------------------------------------------------------------------
# 1. App.tsx
# ---------------------------------------------------------------------------
APP_FILE = "src/App.tsx"

OLD_APP = '''                  listings={listings}
                  filteredListings={filteredListings}'''
NEW_APP = '''                  listings={listings}
                  adListings={adListings}
                  filteredListings={filteredListings}'''

# ---------------------------------------------------------------------------
# 2. MarketplaceTab.tsx
# ---------------------------------------------------------------------------
MARKET_FILE = "src/components/MarketplaceTab.tsx"

OLD_PROP_TYPE = '''  listings: PartListing[];
  filteredListings: PartListing[];'''
NEW_PROP_TYPE = '''  listings: PartListing[];
  adListings: PartListing[];
  filteredListings: PartListing[];'''

OLD_DESTRUCTURE = '''  listings,
  filteredListings,'''
NEW_DESTRUCTURE = '''  listings,
  adListings,
  filteredListings,'''

OLD_SLIDER = '''                {/* 🚀 Boost Ads slide-show */}
                <PromotedSlider 
                  listings={filteredListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                  onOpenLottery={() => setIsLotteryOpen(true)}
                />'''
NEW_SLIDER = '''                {/* 🚀 Boost Ads slide-show — সব বুস্ট করা অ্যাড দেখাবে, category/search filter ছাড়াই,
                    যাতে যিনি পার্ট বুস্ট করেছেন তিনিও Vehicle ট্যাবে নিজের অ্যাড দেখতে পান */}
                <PromotedSlider 
                  listings={adListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                  onOpenLottery={() => setIsLotteryOpen(true)}
                />'''


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
    n1 = apply_fix(APP_FILE, [(OLD_APP, NEW_APP)])
    n2 = apply_fix(MARKET_FILE, [
        (OLD_PROP_TYPE, NEW_PROP_TYPE),
        (OLD_DESTRUCTURE, NEW_DESTRUCTURE),
        (OLD_SLIDER, NEW_SLIDER),
    ])

    total = n1 + n2
    if total == 0:
        print("[SKIP] No changes made — files may already be patched.")
        return

    print(f"[OK] Applied {total} fix(es) across: {', '.join(FILES_CHANGED)}")
    print("Ad banner now shows every live boosted ad (vehicles + parts) on every tab.")


if __name__ == "__main__":
    main()
