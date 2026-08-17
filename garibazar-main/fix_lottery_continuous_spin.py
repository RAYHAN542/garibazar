"""
Update: Lottery wheel now starts spinning immediately on click (a smooth,
continuous fast loop), keeps spinning while waiting for the server, and
then — once the result is known — decelerates smoothly and stops exactly
on the correct segment. No stutter, no visible stop-and-restart.

How it works:
- On click, a CSS keyframe animation spins the wheel continuously and
  fast (1 full turn/second) while we wait for the server.
- The moment the server responds, we compute exactly which angle the
  wheel is visually at (based on elapsed time), freeze it there with no
  transition (so there's no jump), then on the very next frame apply a
  smooth eased transition from that exact angle to the final result.

Run this from the project root (where src/ lives):
    python3 fix_lottery_continuous_spin.py
"""

FILE_PATH = "src/components/LotteryModal.tsx"

REPLACEMENTS = [
    (
        'const SPIN_DURATION_MS = 4200;\nconst WARMUP_SPIN_MS = 900;\nconst FINAL_SPIN_MS = 3300;\nconst SEGMENT_COLORS = ["#f59e0b", "#0f172a"];',
        'const SPIN_DURATION_MS = 4200;\nconst WAIT_LOOP_MS = 1000;\nconst SEGMENT_COLORS = ["#f59e0b", "#0f172a"];',
    ),
    (
        '''  const [wheelRotation, setWheelRotation] = useState(0);
  const [transitionMs, setTransitionMs] = useState(SPIN_DURATION_MS);
  const [isListingPickerOpen, setIsListingPickerOpen] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);''',
        '''  const [wheelRotation, setWheelRotation] = useState(0);
  const [transitionMs, setTransitionMs] = useState(SPIN_DURATION_MS);
  const [waitingForServer, setWaitingForServer] = useState(false);
  const [isListingPickerOpen, setIsListingPickerOpen] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinStartTimeRef = useRef<number>(0);''',
    ),
    (
        '''  const spinWheelTo = (landingIndex: number) => {
    const jitterRange = SEGMENT_ANGLE - 10;
    const jitter = (Math.random() - 0.5) * jitterRange;
    const targetWithinSegment = landingIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + jitter;
    const desiredFinalMod = ((360 - targetWithinSegment) % 360 + 360) % 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const delta = ((desiredFinalMod - currentMod) % 360 + 360) % 360;
    const EXTRA_FULL_SPINS = 5;
    setWheelRotation((prev) => prev + EXTRA_FULL_SPINS * 360 + delta);
  };''',
        '''  const spinWheelTo = (landingIndex: number, fromAngle: number) => {
    const jitterRange = SEGMENT_ANGLE - 10;
    const jitter = (Math.random() - 0.5) * jitterRange;
    const targetWithinSegment = landingIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2 + jitter;
    const desiredFinalMod = ((360 - targetWithinSegment) % 360 + 360) % 360;
    const currentMod = ((fromAngle % 360) + 360) % 360;
    const delta = ((desiredFinalMod - currentMod) % 360 + 360) % 360;
    const EXTRA_FULL_SPINS = 5;
    setWheelRotation(fromAngle + EXTRA_FULL_SPINS * 360 + delta);
  };''',
    ),
    (
        '''    setSpinning(true);

    // ক্লিক করার সাথে সাথেই একটা দ্রুত "ওয়ার্ম-আপ" স্পিন শুরু হয়, যাতে API রেসপন্সের
    // জন্য অপেক্ষা করতে না হয় — চাকা তাৎক্ষণিকভাবে ঘোরা শুরু করে।
    setTransitionMs(WARMUP_SPIN_MS);
    setWheelRotation((prev) => prev + 2 * 360);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ listingId: activeListingId }),
      });

      let data: any = {};
      try {
        const raw = await res.text();
        data = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        throw new Error(
          language === "bn"
            ? "সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। একটু পর আবার চেষ্টা করুন।"
            : "Got an unexpected response from the server. Please try again shortly."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || (language === "bn" ? "কিছু ভুল হয়েছে।" : "Something went wrong."));
      }

      const landingIndex = data.win ? WIN_SEGMENT_INDEX : pickRandomLosingIndex();
      // এখন আসল ফলাফলের দিকে চাকাটা নিয়ে গিয়ে থামানো হচ্ছে।
      setTransitionMs(FINAL_SPIN_MS);
      spinWheelTo(landingIndex);

      spinTimeoutRef.current = setTimeout(() => {
        setResult(data.win ? "win" : "lose");
        setSpinning(false);
      }, FINAL_SPIN_MS);
    } catch (err: any) {
      setError(err?.message || (language === "bn" ? "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।" : "Something went wrong. Please try again."));
      setSpinning(false);
    }
  };''',
        '''    setSpinning(true);
    setWaitingForServer(true);
    spinStartTimeRef.current = Date.now();

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ listingId: activeListingId }),
      });

      let data: any = {};
      try {
        const raw = await res.text();
        data = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        throw new Error(
          language === "bn"
            ? "সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। একটু পর আবার চেষ্টা করুন।"
            : "Got an unexpected response from the server. Please try again shortly."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || (language === "bn" ? "কিছু ভুল হয়েছে।" : "Something went wrong."));
      }

      const landingIndex = data.win ? WIN_SEGMENT_INDEX : pickRandomLosingIndex();

      // চাকাটা ঠিক যেখানে ঘুরছিল (continuous loop) সেখান থেকেই, কোনো ঝাঁকুনি ছাড়াই,
      // আসল ফলাফলের দিকে মসৃণভাবে ধীরে ধীরে থামানো হচ্ছে।
      const elapsed = Date.now() - spinStartTimeRef.current;
      const currentAngle = ((elapsed % WAIT_LOOP_MS) / WAIT_LOOP_MS) * 360;

      // ১) লুপ-স্পিন বন্ধ করে ঠিক ওই মুহূর্তের কোণেই স্থির করা হচ্ছে (transition ছাড়া, তাই ঝাঁকুনি হবে না)
      setWaitingForServer(false);
      setTransitionMs(0);
      setWheelRotation(currentAngle);

      // ২) পরের ফ্রেমে, সেখান থেকেই আসল ফলাফলের দিকে মসৃণভাবে ধীর হয়ে থামানো হচ্ছে
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionMs(SPIN_DURATION_MS);
          spinWheelTo(landingIndex, currentAngle);
        });
      });

      spinTimeoutRef.current = setTimeout(() => {
        setResult(data.win ? "win" : "lose");
        setSpinning(false);
      }, SPIN_DURATION_MS);
    } catch (err: any) {
      setWaitingForServer(false);
      setError(err?.message || (language === "bn" ? "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।" : "Something went wrong. Please try again."));
      setSpinning(false);
    }
  };''',
    ),
    (
        '''  const handleClose = () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    setResult(null);
    setError("");
    setSpinning(false);
    onClose();
  };''',
        '''  const handleClose = () => {
    if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    setResult(null);
    setError("");
    setSpinning(false);
    setWaitingForServer(false);
    onClose();
  };''',
    ),
    (
        '''            <div className="relative w-52 h-52 mx-auto select-none">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-red-500 drop-shadow-md" />

              <div
                className="w-full h-full rounded-full border-[6px] border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
                style={{
                  background: `conic-gradient(from 0deg, ${gradientStops})`,
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: spinning ? `transform ${transitionMs}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : "none",
                }}
              >''',
        '''            <div className="relative w-52 h-52 mx-auto select-none">
              <style>{`
                @keyframes lottery-wait-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-red-500 drop-shadow-md" />

              <div
                className="w-full h-full rounded-full border-[6px] border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
                style={{
                  background: `conic-gradient(from 0deg, ${gradientStops})`,
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: !waitingForServer && spinning ? `transform ${transitionMs}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : "none",
                  animation: waitingForServer ? `lottery-wait-spin ${WAIT_LOOP_MS}ms linear infinite` : "none",
                }}
              >''',
    ),
]


def main():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    changes = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new, 1)
            changes += 1
        else:
            print("⚠️  a pattern was not found (may already be fixed, or an earlier fix wasn't applied yet)")

    if changes == 0:
        print("[SKIP] No changes made — file may already be patched.")
        return

    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[OK] Applied {changes} fix(es) to {FILE_PATH}")
    print("Wheel now spins continuously from the click, and eases smoothly into the result once known.")


if __name__ == "__main__":
    main()
