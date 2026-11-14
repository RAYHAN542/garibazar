import { Capacitor, registerPlugin } from "@capacitor/core";

interface GariBadgePlugin {
  clear(): Promise<void>;
  setCount(options: { count: number }): Promise<void>;
}

export const isGariBadgeAvailable = (): boolean => {
  try {
    return Capacitor.isPluginAvailable("GariBadge");
  } catch (_) {
    return false;
  }
};

const GariBadge = registerPlugin<GariBadgePlugin>("GariBadge");

export function clearBadge(): void {
  if (!isGariBadgeAvailable()) return;
  void GariBadge.clear().catch(() => {});
}

if (typeof document !== "undefined" && isGariBadgeAvailable()) {
  clearBadge();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") clearBadge();
  });
}

export function setBadgeCount(count: number): void {
  if (!isGariBadgeAvailable()) return;
  void GariBadge.setCount({ count: Math.max(0, Math.floor(count) || 0) }).catch(() => {});
}
