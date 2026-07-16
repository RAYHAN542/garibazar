"""
Fix: Hide seller name, profile photo, and 'View Shop' link on the listing
detail page for regular users (since ~60 test listings were posted from
only 3 accounts, showing the same 3 names/photos repeatedly looks fake).

Only admin (isUserAdmin) will still see the full seller identity block.
Regular users will only see: star rating + phone number (unchanged).

Run this from the project root (where src/ lives):
    python3 fix_hide_seller_identity.py
"""

FILES_CHANGED = []

# ---------------------------------------------------------------------------
# 1. App.tsx — pass isAdmin prop down to ListingDetailModal
# ---------------------------------------------------------------------------
APP_FILE = "src/App.tsx"

OLD_APP_SNIPPET = '''        <ListingDetailModal 
          listing={selectedListing}
          language={language}
          currentUser={userMetadata || user}
          onClose={() => setSelectedListing(null)}'''

NEW_APP_SNIPPET = '''        <ListingDetailModal 
          listing={selectedListing}
          language={language}
          currentUser={userMetadata || user}
          isAdmin={isUserAdmin}
          onClose={() => setSelectedListing(null)}'''

# ---------------------------------------------------------------------------
# 2. ListingDetailModal.tsx — add isAdmin prop + conditional seller block
# ---------------------------------------------------------------------------
MODAL_FILE = "src/components/ListingDetailModal.tsx"

OLD_PROPS_SNIPPET = '''  onViewSellerShop?: (sellerId: string, fallbackName: string, fallbackPhoto?: string, fallbackLocation?: string, fallbackContact?: string) => void;
}

export function ListingDetailModal({ listing, language, currentUser, onClose, onPurchaseAdded, onLoginPrompt, onInitiateSellerChat, onViewSellerShop }: ListingDetailModalProps) {'''

NEW_PROPS_SNIPPET = '''  onViewSellerShop?: (sellerId: string, fallbackName: string, fallbackPhoto?: string, fallbackLocation?: string, fallbackContact?: string) => void;
  isAdmin?: boolean;
}

export function ListingDetailModal({ listing, language, currentUser, onClose, onPurchaseAdded, onLoginPrompt, onInitiateSellerChat, onViewSellerShop, isAdmin = false }: ListingDetailModalProps) {'''

OLD_SELLER_BLOCK = '''              <div 
                className={`flex items-center gap-3 ${onViewSellerShop ? "cursor-pointer hover:opacity-85 active:scale-98 transition-all group/seller" : ""}`}
                onClick={() => {
                  if (onViewSellerShop) {
                    onViewSellerShop(
                      listing.sellerId || "unregistered",
                      listing.sellerName,
                      (listing as any).sellerPhoto || "",
                      listing.location || "Dhaka",
                      listing.contactNumber || ""
                    );
                  }
                }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-955 font-black text-lg flex items-center justify-center uppercase shadow-md shadow-amber-500/10 group-hover/seller:rotate-6 transition-transform">
                  {listing.sellerName?.charAt(0)?.toUpperCase() || "S"}
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                    {language === "bn" ? "বিক্রেতার নাম (দোকান দেখুন 🛒)" : "Seller Name (View Shop 🛒)"}
                  </span>
                  <p className="font-extrabold text-slate-850 dark:text-white text-base group-hover/seller:text-amber-500 transition-colors">
                    {listing.sellerName}
                  </p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className={`w-3 h-3 ${star <= (listing.sellerRating || 5) ? "fill-amber-400 text-amber-400" : "fill-slate-700 text-slate-700"}`} />
                    ))}
                    <span className="text-[10px] text-slate-500 font-bold ml-1">({listing.sellerReviewCount || Math.floor(Math.random() * 10) + 1})</span>
                  </div>
                </div>
              </div>'''

NEW_SELLER_BLOCK = '''              {isAdmin ? (
                <div 
                  className={`flex items-center gap-3 ${onViewSellerShop ? "cursor-pointer hover:opacity-85 active:scale-98 transition-all group/seller" : ""}`}
                  onClick={() => {
                    if (onViewSellerShop) {
                      onViewSellerShop(
                        listing.sellerId || "unregistered",
                        listing.sellerName,
                        (listing as any).sellerPhoto || "",
                        listing.location || "Dhaka",
                        listing.contactNumber || ""
                      );
                    }
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-955 font-black text-lg flex items-center justify-center uppercase shadow-md shadow-amber-500/10 group-hover/seller:rotate-6 transition-transform">
                    {listing.sellerName?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      {language === "bn" ? "বিক্রেতার নাম (দোকান দেখুন 🛒)" : "Seller Name (View Shop 🛒)"}
                    </span>
                    <p className="font-extrabold text-slate-850 dark:text-white text-base group-hover/seller:text-amber-500 transition-colors">
                      {listing.sellerName}
                    </p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-3 h-3 ${star <= (listing.sellerRating || 5) ? "fill-amber-400 text-amber-400" : "fill-slate-700 text-slate-700"}`} />
                      ))}
                      <span className="text-[10px] text-slate-500 font-bold ml-1">({listing.sellerReviewCount || Math.floor(Math.random() * 10) + 1})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      {language === "bn" ? "বিক্রেতা রেটিং" : "Seller Rating"}
                    </span>
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-3 h-3 ${star <= (listing.sellerRating || 5) ? "fill-amber-400 text-amber-400" : "fill-slate-700 text-slate-700"}`} />
                      ))}
                      <span className="text-[10px] text-slate-500 font-bold ml-1">({listing.sellerReviewCount || Math.floor(Math.random() * 10) + 1})</span>
                    </div>
                  </div>
                </div>
              )}'''


def apply_fix(path, replacements):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    changed = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            changed += 1
        else:
            print(f"⚠️  pattern not found in {path} (may already be fixed)")
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        FILES_CHANGED.append(path)
    return changed


def main():
    n1 = apply_fix(APP_FILE, [(OLD_APP_SNIPPET, NEW_APP_SNIPPET)])
    n2 = apply_fix(MODAL_FILE, [
        (OLD_PROPS_SNIPPET, NEW_PROPS_SNIPPET),
        (OLD_SELLER_BLOCK, NEW_SELLER_BLOCK),
    ])

    total = n1 + n2
    if total == 0:
        print("[SKIP] No changes made — files may already be patched.")
        return

    print(f"[OK] Applied {total} fix(es) across: {', '.join(FILES_CHANGED)}")
    print("Seller name/photo/View-Shop are now admin-only. Phone number & rating stay visible to everyone.")


if __name__ == "__main__":
    main()
