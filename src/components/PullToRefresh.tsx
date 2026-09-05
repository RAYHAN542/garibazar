import { useEffect, useRef, useState } from "react";

export default function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  const THRESHOLD = 70;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !refreshing) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || startYRef.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPullDistance(Math.min(delta * 0.5, 100));
      } else {
        pullingRef.current = false;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        window.location.reload();
      } else {
        setPullDistance(0);
      }
      startYRef.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, refreshing]);

  if (pullDistance === 0 && !refreshing) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex justify-center items-center pointer-events-none transition-transform"
      style={{
        height: 50,
        transform: `translateY(${pullDistance - 50}px)`,
      }}
    >
      <div
        className={`w-7 h-7 rounded-full border-2 border-amber-500 border-t-transparent ${
          refreshing ? "animate-spin" : ""
        }`}
        style={{
          transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
        }}
      />
    </div>
  );
}
