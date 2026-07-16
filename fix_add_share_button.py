"""
Feature: Real "Share" button on listing detail page.
- Uses the native share sheet (navigator.share) when available (most phones),
  falls back to copying a shareable link to clipboard.
- Shared link format: <site>?listing=<id> — App.tsx now detects this on load
  and automatically opens that exact listing for whoever clicks it.
This drives real views/traffic instead of faking numbers.

Run this from the project root (where src/ lives):
    python3 fix_add_share_button.py
"""

FILES_CHANGED = []

# ---------------------------------------------------------------------------
# 1. ListingDetailModal.tsx
# ---------------------------------------------------------------------------
MODAL_FILE = "src/components/ListingDetailModal.tsx"

OLD_IMPORT = 'import { X, Eye, MapPin, Sparkles, Play, SquarePlay, Heart, Flag, ShieldAlert, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, Loader2, ShoppingBag, Star, User, MessageSquare, Calendar, Send } from "lucide-react";'
NEW_IMPORT = 'import { X, Eye, MapPin, Sparkles, Play, SquarePlay, Heart, Flag, ShieldAlert, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, Loader2, ShoppingBag, Star, User, MessageSquare, Calendar, Send, Share2 } from "lucide-react";'

OLD_STATE_BLOCK = """  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  const [addToDashboardSuccess, setAddToDashboardSuccess] = useState(false);"""

NEW_STATE_BLOCK = """  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  const [addToDashboardSuccess, setAddToDashboardSuccess] = useState(false);

  // Share state (shows "Link Copied" feedback when Web Share API isn't available)
  const [shareCopied, setShareCopied] = useState(false);

  const handleShareListing = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?listing=${listing.id}`;
    const shareTitle = listing.title;
    const shareText = language === "bn"
      ? `গাড়ি বাজারে দেখুন: ${listing.title}`
      : `Check this out on Gari Bazar: ${listing.title}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      }
    } catch (e) {
      // user cancelled share sheet or it failed silently — fall through to clipboard copy
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      console.error("Could not copy share link:", e);
    }
  };"""

OLD_REPORT_BLOCK_MARKER = """              {/* Report Option */}
              {!isOwner && ("""

NEW_REPORT_BLOCK_MARKER = """              {/* Share Option */}
              <button
                type="button"
                onClick={handleShareListing}
                className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                  shareCopied
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : "bg-white border-slate-200 text-slate-505 hover:bg-slate-50 hover:text-amber-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 dark:hover:text-amber-400"
                }`}
              >
                {shareCopied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>
                  {shareCopied
                    ? (language === "bn" ? "লিংক কপি হয়েছে!" : "Link Copied!")
                    : (language === "bn" ? "শেয়ার করুন" : "Share")
                  }
                </span>
              </button>

              {/* Report Option */}
              {!isOwner && ("""

# ---------------------------------------------------------------------------
# 2. App.tsx — deep link: ?listing=<id> auto-opens that listing
# ---------------------------------------------------------------------------
APP_FILE = "src/App.tsx"

OLD_APP_BLOCK = """  // Dynamic bookmarks matching
  const savedListings = useMemo(() => {
    return listings.filter((item) => savedListingIds.includes(item.id));
  }, [listings, savedListingIds]);"""

NEW_APP_BLOCK = """  // Dynamic bookmarks matching
  const savedListings = useMemo(() => {
    return listings.filter((item) => savedListingIds.includes(item.id));
  }, [listings, savedListingIds]);

  // Open a specific listing when arriving via a shared link (?listing=<id>).
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
  }, [listings, hasOpenedSharedListing]);"""


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
    n1 = apply_fix(MODAL_FILE, [
        (OLD_IMPORT, NEW_IMPORT),
        (OLD_STATE_BLOCK, NEW_STATE_BLOCK),
        (OLD_REPORT_BLOCK_MARKER, NEW_REPORT_BLOCK_MARKER),
    ])
    n2 = apply_fix(APP_FILE, [(OLD_APP_BLOCK, NEW_APP_BLOCK)])

    total = n1 + n2
    if total == 0:
        print("[SKIP] No changes made — files may already be patched.")
        return

    print(f"[OK] Applied {total} fix(es) across: {', '.join(FILES_CHANGED)}")
    print("Share button added to listing detail page. Shared links now deep-link to the exact listing.")


if __name__ == "__main__":
    main()
