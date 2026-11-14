import { isGariBadgeAvailable } from "./gariBadge";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../supabase";
import { loadInterest } from "./feedRanker";

// ---------------------------------------------------------------------------
// 🔔 লগইন ছাড়া ক্রেতার জন্য পুশ নোটিফিকেশন (পছন্দের গাড়ির অ্যালার্ট)।
//
// আগে ডিভাইসের পুশ টোকেন শুধু লগইন করা ইউজারের `users.fcm_token` এ যেত, আর
// ফোনের অনুমতিও শুধু লগইনের সময় চাওয়া হতো -- তাই লগইনহীন ডিভাইসে পুশ পাঠানোর
// উপায় ছিল না। এখন টোকেন আর পছন্দ (ব্র্যান্ড/মডেল) `device_push_tokens` টেবিলে
// (register_device_push RPC দিয়ে) জমা হয়; কোনো অ্যাকাউন্ট লাগে না।
// ---------------------------------------------------------------------------

const DEVICE_KEY = "gb_device_id";
const ASK_KEY = "gb_notif_ask_v1";
const NATIVE_PUSH_STATUS_KEY = "gari_bazar_native_push_status";
// প্রথমবার দেখানোর পর কত দিন পরপর আবার দেখানো হবে: ২, ৫, ১০ দিন (সর্বোচ্চ ৩ বার আবার)
const REASK_GAP_DAYS = [2, 5, 10];

export type PushPerm = "granted" | "denied" | "default" | "unsupported";

export const isNativeDevice = (): boolean => {
  try {
    const c = (window as any).Capacitor;
    return !!c && typeof c.isNativePlatform === "function" && c.isNativePlatform();
  } catch (_) {
    return false;
  }
};

// trackAppInstall.ts এর মতোই একই চাবিতে ডিভাইস আইডি (না থাকলে বানায়)
function getDeviceId(): string {
  let id = "";
  try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch (_) {}
  if (!/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    const c: any = (globalThis as any).crypto;
    id =
      c && typeof c.randomUUID === "function"
        ? c.randomUUID()
        : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
  }
  return id;
}

function topEntries(map: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(map || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => [k, Math.round(v * 100) / 100])
  );
}

// সার্ভারে যাবে শুধু ব্র্যান্ড/মডেল/গড় দাম -- কোনো নাম, নম্বর বা লিস্টিং নয়
function interestsPayload() {
  const it = loadInterest();
  return {
    b: topEntries(it.b, 8),
    m: topEntries(it.m, 8),
    p: it.pW > 0 ? Math.round(it.pSum / it.pW) : 0,
    v: isGariBadgeAvailable() ? 2 : 1,
  };
}

export async function checkPushPerm(): Promise<PushPerm> {
  if (!isNativeDevice()) return "unsupported";
  try {
    const p = await PushNotifications.checkPermissions();
    if (p.receive === "granted") return "granted";
    if (p.receive === "denied") return "denied";
    return "default";
  } catch (_) {
    return "unsupported";
  }
}

let syncing = false;
let syncedThisSession = false;

/** অনুমতি থাকলে ডিভাইসের টোকেন + আগ্রহ সার্ভারে জমা দেয়। force=true হলে এই সেশনে আবারও। */
export async function syncDeviceToken(force = false): Promise<void> {
  if (!isNativeDevice() || syncing) return;
  if (syncedThisSession && !force) return;
  syncing = true;
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") return;
    // handle আলাদা ভেরিয়েবলে রাখা হলো, যাতে নিজের ইনিশিয়ালাইজারে নিজেকে ডাকার টাইপ-সমস্যা না হয়
    let handle: { remove: () => Promise<void> } | null = null;
    handle = await PushNotifications.addListener("registration", async (token) => {
      try {
        if (token?.value) {
          await supabase.rpc("register_device_push", {
            p_device_id: getDeviceId(),
            p_token: token.value,
            p_interests: interestsPayload(),
          });
          syncedThisSession = true;
        }
      } catch (_) {
        // নেটওয়ার্ক না থাকলে চুপচাপ বাদ, পরের বার খুললে আবার চেষ্টা হবে
      }
      try { await handle?.remove(); } catch (_) {}
    });
    await PushNotifications.register();
  } catch (_) {
    // পুশ কখনো অ্যাপ ভাঙবে না
  } finally {
    syncing = false;
  }
}

/** ফোনের আসল অনুমতি চায় (প্রথমবার)। সফল হলে টোকেন জমা দেয়। */
export async function requestDevicePush(): Promise<PushPerm> {
  if (!isNativeDevice()) return "unsupported";
  try {
    let p = await PushNotifications.checkPermissions();
    if (p.receive === "prompt" || p.receive === "prompt-with-rationale") {
      p = await PushNotifications.requestPermissions();
    }
    const result: PushPerm = p.receive === "granted" ? "granted" : "denied";
    try { localStorage.setItem(NATIVE_PUSH_STATUS_KEY, result); } catch (_) {}
    if (result === "granted") await syncDeviceToken(true);
    return result;
  } catch (_) {
    return "unsupported";
  }
}

// ---- নরম পপআপ কবে দেখানো হবে (প্রথমবার, তারপর ২/৫/১০ দিন পরে, সর্বোচ্চ ৩ বার আবার) ----

export function shouldAutoAsk(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(ASK_KEY) || "{}");
    const n = Number(s.n) || 0;
    const last = Number(s.last) || 0;
    if (n === 0) return true;
    if (n > REASK_GAP_DAYS.length) return false;
    return Date.now() - last >= REASK_GAP_DAYS[n - 1] * 86400000;
  } catch (_) {
    return false;
  }
}

export function recordAsked(): void {
  try {
    const s = JSON.parse(localStorage.getItem(ASK_KEY) || "{}");
    localStorage.setItem(ASK_KEY, JSON.stringify({ n: (Number(s.n) || 0) + 1, last: Date.now() }));
  } catch (_) {}
}
