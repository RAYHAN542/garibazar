import { PartListing } from "../types";

// 🔔 নোটিফিকেশনের "না-দেখা সংখ্যা": ইনবক্স শেষ কখন খোলা হয়েছিল তার পর যত নতুন পোস্ট এসেছে (সর্বোচ্চ গত ২ দিন)।
// ফোনে (localStorage) জমা থাকে, লগইন লাগে না।
const KEY = "gb_notif_seen_v1";
const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export function getSeenTs(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) ? v : 0;
  } catch (_) {
    return 0;
  }
}

/** ইনবক্স খুললে ডাকা হয়; সংখ্যা ০ হয়ে যায়। */
export function markNotifSeen(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
    window.dispatchEvent(new Event("gb:notif-seen"));
  } catch (_) {}
}

export function countUnread(items: PartListing[]): number {
  const since = Math.max(getSeenTs(), Date.now() - WINDOW_MS);
  const seen = new Set<string>();
  let n = 0;
  for (const l of items) {
    if (!l || l.isSold || seen.has(l.id)) continue;
    seen.add(l.id);
    const t = new Date(l.createdAt as any).getTime();
    if (Number.isFinite(t) && t > since) n++;
  }
  return n;
}
