# Run this once from your project root: python3 fix_boost_banner.py
# It moves the Boost Ads slider (PromotedSlider) to right below the
# "গাড়ি বেচা/কেনা" / "গাড়ির পাট" buttons in src/App.tsx

import re

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_block = '''                {/* Promo Spotlight slide-show */}
                <PromotedSlider 
                  listings={filteredListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                />

                {/* Filter count indicators */}'''

new_tail = "                {/* Filter count indicators */}"

if old_block not in content:
    print("⚠️  Old PromotedSlider block not found — may already be moved, or file changed. No changes made.")
else:
    content = content.replace(old_block, new_tail, 1)

    insert_marker = "                {/* 🛠️ Modern Filters & Dynamic Sorting Panel (Revealed dynamically!) */}"
    insertion = '''                {/* 🚀 Boost Ads slide-show */}
                <PromotedSlider 
                  listings={filteredListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                />

''' + insert_marker

    if insert_marker not in content:
        print("⚠️  Insert marker not found. No changes made.")
    else:
        content = content.replace(insert_marker, insertion, 1)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("✅ Done! Boost Ads banner moved below the category buttons in src/App.tsx")
