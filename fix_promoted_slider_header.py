"""
Redesign of the promoted-listings banner top area:

1. Removed the "🚀 Boost Ads" title row + separate "Free Boost Lottery"
   pill that sat above the banner card.
2. Replaced the plain, cheap-looking "+" circle in the card's top-right
   corner with a proper pill button: "Free Ads" text -> arrow -> a
   small "+" icon in a circle. Same click behavior (opens the lottery).

Run this from the project root (where src/ lives):
    python3 fix_promoted_slider_header.py
"""

FILE_PATH = "src/components/PromotedSlider.tsx"

OLD_IMPORT = 'import { MapPin, ArrowRight, Gift } from "lucide-react";'
NEW_IMPORT = 'import { MapPin, ArrowRight, Plus } from "lucide-react";'

OLD_HEADER = '''  return (
    <div className="mb-4 w-full max-w-xl mx-auto animate-fade-in">
      {/* Title with rocket icon + free daily lottery CTA */}
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base">🚀</span>
          <h3 className="text-sm sm:text-base font-black font-sans text-slate-800 dark:text-slate-100 tracking-tight truncate">
            {language === "bn" ? "বুস্ট বিজ্ঞাপন" : "Boost Ads"}
          </h3>
        </div>
        <button
          id="open-lottery-btn"
          onClick={onOpenLottery}
          className="shrink-0 flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-[10px] sm:text-xs px-3 py-1.5 rounded-full shadow-md transition cursor-pointer"
        >
          <Gift className="w-3.5 h-3.5" />
          {language === "bn" ? "ফ্রী বুস্ট লটারি" : "Free Boost Lottery"}
        </button>
      </div>

      {currentItem && ('''

NEW_HEADER = '''  return (
    <div className="mb-4 w-full max-w-xl mx-auto animate-fade-in">
      {currentItem && ('''

OLD_PLUS_BUTTON = '''        {/* Top-Right corner "+" button — ট্যাপ করলে ফ্রী বুস্ট লটারি খুলবে */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLottery();
          }}
          title={language === "bn" ? "ফ্রী বুস্ট লটারি" : "Free Boost Lottery"}
          className="absolute top-3.5 right-3.5 z-10 w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-md transition cursor-pointer"
        >
          +
        </button>'''

NEW_PLUS_BUTTON = '''        {/* Top-Right "Free Ads" pill — ট্যাপ করলে ফ্রী বুস্ট লটারি খুলবে */}
        <button
          id="open-lottery-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLottery();
          }}
          title={language === "bn" ? "ফ্রী বুস্ট লটারি" : "Free Boost Lottery"}
          className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-[10px] sm:text-xs pl-3 pr-1.5 py-1 rounded-full shadow-md transition cursor-pointer active:scale-95"
        >
          <span className="whitespace-nowrap">
            {language === "bn" ? "ফ্রি বিজ্ঞাপন" : "Free Ads"}
          </span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="w-5 h-5 rounded-full bg-slate-950/15 flex items-center justify-center shrink-0">
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        </button>'''


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changes = 0
    for old, new in [
        (OLD_IMPORT, NEW_IMPORT),
        (OLD_HEADER, NEW_HEADER),
        (OLD_PLUS_BUTTON, NEW_PLUS_BUTTON),
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
