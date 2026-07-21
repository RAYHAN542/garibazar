import { useMemo, useRef, useState } from "react";
import { X, PartyPopper, Frown, Loader2, ShieldAlert, Gift } from "lucide-react";
import { PartListing, SupportedLanguage } from "../types";
import { auth } from "../firebase";

interface LotteryModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  currentUser: any;
  userMetadata: any;
  listings: PartListing[];
  setIsAuthOpen: (v: boolean) => void;
}

const getTodayInDhaka = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
};

// ---- Spin wheel geometry ----
const WHEEL_SEGMENTS = 8;
const WIN_SEGMENT_INDEX = 0;
const SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS;
const SPIN_DURATION_MS = 4200;
const SEGMENT_COLORS = ["#f59e0b", "#0f172a"];

export function LotteryModal({ isOpen, onClose, language, currentUser, userMetadata, listings, setIsAuthOpen }: LotteryModalProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>("");
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const eligibleListings = useMemo(() => {
    if (!currentUser?.uid) return [];
    return listings.filter((item) => item.sellerId === currentUser.uid && !item.isAd);
  }, [listings, currentUser?.uid]);

  const activeListingId = selectedListingId || eligibleListings[0]?.id || "";

  const usedToday = userMetadata?.lastLotteryDate === getTodayInDhaka();

  if (!isOpen) return null;

  const spinWheelTo = (landingIndex: number) => {
    const jitterRange = SEGMENT_ANGLE - 10;
    const jitter = (Math.random() - 0.5) * jitterRange;
    const targetWithinSegment = landingIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + jitter;
    const desiredFinalMod = ((360 - targetWithinSegment) % 360 + 360) % 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const delta = ((desiredFinalMod - currentMod) % 360 + 360) % 360;
    const EXTRA_FULL_SPINS = 5;
    setWheelRotation((prev) => prev + EXTRA_FULL_SPINS * 360 + delta);
  };

  const pickRandomLosingIndex = (): number => {
    const options = Array.from({ length: WHEEL_SEGMENTS }, (_, i) => i).filter((i) => i !== WIN_SEGMENT_INDEX);
    return options[Math.floor(Math.random() * options.length)];
  };

  const handleSpin = async () => {
    setError("");

    if (!currentUser) {
      onClose();
      setIsAuthOpen(true);
      return;
    }

    if (!activeListingId) {
      setError(language === "bn" ? "প্রথমে একটি প্রোডাক্ট পোস্ট করুন, তারপর লটারিতে অংশ নিন।" : "Post a product first, then join the lottery.");
      return;
    }

    setSpinning(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/lottery/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ listingId: activeListingId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (language === "bn" ? "কিছু ভুল হয়েছে।" : "Something went wrong."));
      }

      const landingIndex = data.win ? WIN_SEGMENT_INDEX : pickRandomLosingIndex();
      spinWheelTo(landingIndex);

      spinTimeoutRef.current = setTimeout(() => {
        setResult(data.win ? "win" : "lose");
        setSpinning(false);
      }, SPIN_DURATION_MS);
    } catch (err: any) {
      setError(err?.message || (language === "bn" ? "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।" : "Something went wrong. Please try again."));
      setSpinning(false);
    }
  };

  const handleClose = () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    setResult(null);
    setError("");
    setSpinning(false);
    onClose();
  };

  const gradientStops = Array.from({ length: WHEEL_SEGMENTS })
    .map((_, i) => `${SEGMENT_COLORS[i % 2]} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`)
    .join(", ");

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"></div>

        <button
          id="close-lottery-modal-btn"
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {result === "win" ? (
          <div className="text-center py-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
              <PartyPopper className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {language === "bn" ? "🎉 অভিনন্দন! আপনি জিতেছেন!" : "🎉 Congratulations, you won!"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
              {language === "bn"
                ? "আপনার প্রোডাক্টটি এখন ২৪ ঘণ্টার জন্য ফ্রী ফিচার্ড বিজ্ঞাপন হিসেবে লাইভ হয়ে গেছে!"
                : "Your listing is now live as a free Featured ad for the next 24 hours!"}
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              {language === "bn" ? "ঠিক আছে" : "Got it"}
            </button>
          </div>
        ) : result === "lose" ? (
          <div className="text-center py-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-slate-500/10 text-slate-400 rounded-full flex items-center justify-center">
              <Frown className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {language === "bn" ? "এবার হয়নি" : "Not this time"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
              {language === "bn"
                ? "আজকের লটারিতে জিততে পারেননি। কাল আবার চেষ্টা করুন — প্রতিদিন ১টি ফ্রী সুযোগ!"
                : "You didn't win this time. Come back tomorrow for another free spin!"}
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              {language === "bn" ? "বন্ধ করুন" : "Close"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-amber-500 text-[10px] font-black tracking-widest uppercase block mb-1">
                {language === "bn" ? "প্রতিদিন ১টি ফ্রী সুযোগ" : "ONE FREE SPIN EVERY DAY"}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-sans tracking-tight">
                {language === "bn" ? "ফ্রী বুস্ট লটারি" : "Free Boost Lottery"}
              </h3>
            </div>

            <div className="relative w-52 h-52 mx-auto select-none">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-red-500 drop-shadow-md" />

              <div
                className="w-full h-full rounded-full border-[6px] border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
                style={{
                  background: `conic-gradient(from 0deg, ${gradientStops})`,
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: spinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : "none",
                }}
              >
                {Array.from({ length: WHEEL_SEGMENTS }).map((_, i) => {
                  const angle = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
                  return (
                    <div key={i} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                      <span className="absolute top-2.5 left-1/2 -translate-x-1/2 text-white font-black text-sm drop-shadow">
                        {i === WIN_SEGMENT_INDEX ? "🎁" : i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border-4 border-amber-500 shadow-md flex items-center justify-center">
                  <Gift className="w-4 h-4 text-amber-500" />
                </div>
              </div>
            </div>

            <p className="text-slate-500 dark:text-slate-450 text-xs text-center leading-relaxed px-2">
              {language === "bn"
                ? "প্রতি ১০০ জনের মধ্যে ১ জন র‍্যান্ডম বিজয়ী হন — জিতলে আপনার প্রোডাক্ট ২৪ ঘণ্টার জন্য ফ্রী ফিচার্ড বিজ্ঞাপন হিসেবে লাইভ হয়ে যাবে।"
                : "1 in 100 people randomly win — winners get their listing live as a free Featured ad for 24 hours."}
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-655 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {currentUser && eligibleListings.length > 1 && (
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
            )}

            {currentUser && eligibleListings.length === 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400 text-center">
                {language === "bn" ? "লটারিতে অংশ নিতে প্রথমে একটি প্রোডাক্ট পোস্ট করুন।" : "Post a product first to join the lottery."}
              </div>
            )}

            {currentUser && usedToday && !error && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-semibold text-center">
                {language === "bn" ? "আজকের সুযোগ ব্যবহার করা হয়ে গেছে। কাল আবার আসুন!" : "You've used today's spin. Come back tomorrow!"}
              </div>
            )}

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning || (!!currentUser && (usedToday || eligibleListings.length === 0))}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black py-3 px-4 rounded-xl text-sm transition duration-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              {spinning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === "bn" ? "ঘুরছে..." : "Spinning..."}</span>
                </>
              ) : (
                <span>{!currentUser ? (language === "bn" ? "লগইন করে অংশ নিন" : "Login to Join") : (language === "bn" ? "লটারি ঘোরান" : "Spin the Lottery")}</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
