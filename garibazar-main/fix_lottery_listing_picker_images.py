"""
Fix: In the "Free Boost Lottery" modal, the "Which listing should enter?"
picker was a native HTML <select>, which can only show text — browsers
don't support images inside <option> elements, so no product photo ever
showed, only the name.

Replaced it with a custom dropdown (a button + a tappable list) that
shows each listing's thumbnail image next to its title, both in the
closed state and in the open list, with a checkmark on the selected one.

Run this from the project root (where src/ lives):
    python3 fix_lottery_listing_picker_images.py
"""

FILE_PATH = "src/components/LotteryModal.tsx"

OLD_IMPORT = 'import { X, PartyPopper, Frown, Loader2, ShieldAlert, Gift } from "lucide-react";'
NEW_IMPORT = 'import { X, PartyPopper, Frown, Loader2, ShieldAlert, Gift, ChevronDown, Check } from "lucide-react";'

OLD_STATE = '''export function LotteryModal({ isOpen, onClose, language, currentUser, userMetadata, listings, setIsAuthOpen }: LotteryModalProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [transitionMs, setTransitionMs] = useState(SPIN_DURATION_MS);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eligibleListings = useMemo(() => {
    if (!currentUser?.uid) return [];
    return listings.filter((item) => item.sellerId === currentUser.uid && !item.isAd);
  }, [listings, currentUser?.uid]);

  const activeListingId = selectedListingId || eligibleListings[0]?.id || "";'''

NEW_STATE = '''export function LotteryModal({ isOpen, onClose, language, currentUser, userMetadata, listings, setIsAuthOpen }: LotteryModalProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [transitionMs, setTransitionMs] = useState(SPIN_DURATION_MS);
  const [isListingPickerOpen, setIsListingPickerOpen] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eligibleListings = useMemo(() => {
    if (!currentUser?.uid) return [];
    return listings.filter((item) => item.sellerId === currentUser.uid && !item.isAd);
  }, [listings, currentUser?.uid]);

  const activeListingId = selectedListingId || eligibleListings[0]?.id || "";
  const activeListing = eligibleListings.find((item) => item.id === activeListingId) || null;'''

OLD_SELECT = '''            {currentUser && eligibleListings.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  {language === "bn" ? "কোন প্রোডাক্ট দিয়ে অংশ নিতে চান?" : "Which listing should enter?"}
                </span>
                <select
                  value={activeListingId}
                  onChange={(e) => setSelectedListingId(e.target.value)}
                  disabled={spinning}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none dark:text-white font-semibold disabled:opacity-60"
                >
                  {eligibleListings.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </div>
            )}'''

NEW_SELECT = '''            {currentUser && eligibleListings.length > 1 && (
              <div className="space-y-1.5 relative">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  {language === "bn" ? "কোন প্রোডাক্ট দিয়ে অংশ নিতে চান?" : "Which listing should enter?"}
                </span>

                <button
                  type="button"
                  disabled={spinning}
                  onClick={() => setIsListingPickerOpen((v) => !v)}
                  className="w-full flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-2.5 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none dark:text-white font-semibold disabled:opacity-60 cursor-pointer"
                >
                  <img
                    src={activeListing?.images?.[0] || activeListing?.image || ""}
                    alt={activeListing?.title || ""}
                    className="w-8 h-8 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                    referrerPolicy="no-referrer"
                  />
                  <span className="flex-1 min-w-0 text-left truncate">{activeListing?.title}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${isListingPickerOpen ? "rotate-180" : ""}`} />
                </button>

                {isListingPickerOpen && (
                  <>
                    {/* Tap-outside-to-close backdrop */}
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsListingPickerOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {eligibleListings.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedListingId(item.id);
                            setIsListingPickerOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 py-2 px-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                        >
                          <img
                            src={item.images?.[0] || item.image || ""}
                            alt={item.title}
                            className="w-8 h-8 rounded-lg object-cover shrink-0 bg-slate-200 dark:bg-slate-800"
                            referrerPolicy="no-referrer"
                          />
                          <span className="flex-1 min-w-0 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {item.title}
                          </span>
                          {item.id === activeListingId && (
                            <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changes = 0
    for old, new in [
        (OLD_IMPORT, NEW_IMPORT),
        (OLD_STATE, NEW_STATE),
        (OLD_SELECT, NEW_SELECT),
    ]:
        if old in content:
            content = content.replace(old, new, 1)
            changes += 1
        else:
            print("⚠️  a pattern was not found (may already be fixed)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} fix(es) to {FILE_PATH}")


if __name__ == "__main__":
    main()
