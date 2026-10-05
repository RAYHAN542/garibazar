import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NativeAds, NATIVE_FEED_UNIT, initNativeAds, isNativeAdsSupported } from "../utils/nativeAds";

type Status = "loading" | "ready" | "failed";
type Payload =
  | { visible: false }
  | { visible: true; x: number; y: number; width: number; height: number; clipBottom: number };

function NativeAdSlotInner({ slotId }: { slotId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [height, setHeight] = useState(320);

  // ১) ad লোড
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initNativeAds();
        await NativeAds.load({ id: slotId, adUnitId: NATIVE_FEED_UNIT });
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      NativeAds.destroy({ id: slotId }).catch(() => {});
    };
  }, [slotId]);

  // ২) কার্ডের উচ্চতা (মিডিয়া >= ১২০dp রাখতে ২৮০-৩৬০dp)
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const apply = () => {
      const w = el.clientWidth;
      if (w > 0) setHeight(Math.min(360, Math.max(280, Math.round(w * 0.5625 + 156))));
    };
    apply();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status]);

  // ৩) native ad view-কে জায়গার সাথে আটকে রাখা
  useEffect(() => {
    if (status !== "ready") return undefined;
    const host = hostRef.current;
    if (!host) return undefined;

    let raf = 0;
    let stopped = false;
    let inFlight = false;
    let pending: Payload | null = null;
    let lastKey = "";

    const dispatch = (p: Payload) => {
      if (inFlight) {
        pending = p;
        return;
      }
      inFlight = true;
      const call = p.visible
        ? NativeAds.show({ id: slotId, x: p.x, y: p.y, width: p.width, height: p.height, clipTop: 0, clipBottom: p.clipBottom })
        : NativeAds.hide({ id: slotId });
      call
        .catch(() => {})
        .then(() => {
          inFlight = false;
          if (pending && !stopped) {
            const next = pending;
            pending = null;
            dispatch(next);
          }
        });
    };

    const tick = () => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);

      const r = host.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // নিচের fixed মেনু বার (থাকলে) যেখানে শুরু, ad সেখানে কাটা পড়বে
      let clipBottom = vh;
      document.querySelectorAll<HTMLElement>(".fixed.bottom-0").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width > vw * 0.8 && b.height > 0 && b.top > 0 && b.top < clipBottom) clipBottom = b.top;
      });

      const visTop = Math.max(r.top, 0);
      const visBottom = Math.min(r.bottom, clipBottom);
      let visible = r.width > 0 && r.height > 0 && visBottom - visTop > 4;

      // ওপরে মডাল/সার্চ/শহর বাছাই খোলা থাকলে ad লুকাও
      if (visible) {
        const px = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
        const py = (visTop + visBottom) / 2;
        const top = document.elementFromPoint(px, py);
        if (!top || !host.contains(top)) visible = false;
      }

      const payload: Payload = visible
        ? { visible: true, x: r.left, y: r.top, width: r.width, height: r.height, clipBottom }
        : { visible: false };
      const key = payload.visible
        ? [payload.x, payload.y, payload.width, payload.height, payload.clipBottom].map((n) => Math.round(n * 2)).join(",")
        : "hidden";
      if (key === lastKey) return;
      lastKey = key;
      dispatch(payload);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      NativeAds.hide({ id: slotId }).catch(() => {});
    };
  }, [status, slotId]);

  if (status !== "ready") return null;
  return (
    <div
      ref={hostRef}
      className="col-span-full rounded-xl bg-slate-100 dark:bg-slate-800"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

/** ওয়েবসাইটে null রেন্ডার করে, শুধু Android অ্যাপে ad দেখায়। */
export function NativeAdSlot({ slotId }: { slotId: string }) {
  if (!isNativeAdsSupported()) return null;
  return <NativeAdSlotInner slotId={slotId} />;
}
