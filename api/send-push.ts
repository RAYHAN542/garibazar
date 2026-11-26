import { initializeApp, getApps, cert } from "firebase-admin/app";
import { sendSmart, sendMulticastSmart } from "./_lib/pushCompat.js";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_lib/cors.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";

// 🔔 Sends a real native push notification (via Firebase Cloud Messaging) to
// one signed-in user's registered device, using the FCM token saved by
// usePushNotifications.ts into users.fcm_token. Uses the same
// FIREBASE_SERVICE_ACCOUNT_KEY env var already set up for api/draw.ts.
//
// This endpoint only lets a signed-in user trigger a push to THEMSELVES
// (e.g. a "send me a test notification" button) -- sending to OTHER users
// (e.g. "notify the seller of a new chat message") should be called
// server-side from the relevant API route (chat send, new listing, etc.)
// using sendPushToUid() directly, not through this public endpoint.
if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

// 🔧 (2026-11-13) "নতুন বিজ্ঞাপন" ব্রডকাস্ট সব ইউজারের কাছে যায়। সীমা:
//  ১) রাত ১২টা থেকে সকাল ৮টা (বাংলাদেশ সময়) কোনো ব্রডকাস্ট নয়।
//  ২) দুই ব্রডকাস্টের মাঝে কমপক্ষে ৩০ মিনিট (মালিকের সিদ্ধান্ত: প্রায় প্রতি ৩০ মিনিটে একটা নতুন
//     পোস্ট আসে, তাই প্রতিটা পোস্টেই নোটিফিকেশন যাবে)। এর মধ্যে আরেকটা পোস্ট এলে সেটার
//     ব্রডকাস্ট বাদ যায়, পরে জমে না (পছন্দের গাড়ির অ্যালার্ট আলাদা, সেটা ডেটাবেস পাঠায়)।
//     আগে এই ফাঁক ছিল ৩০ মিনিট, ২০২৬-১১-০৮ এ ৫ ঘণ্টা করা হয়েছিল, এখন আবার ৩০ মিনিট।
// চ্যাট মেসেজের পুশে এই সীমা নেই -- ওটা একজনের কাছে যাওয়া সরাসরি বার্তা।
//
// 🔴 (2026-11-14) নোটিফিকেশনে আর `tag` নেই (আগে "new_listing"/"device_alert" tag দিয়ে নতুনটা পুরনোটাকে
// বদলে দিত, তাই ট্রেতে সবসময় ১টা থাকত আর আইকনের লাল সংখ্যা ১-এর বেশি হতো না)। এখন প্রতিটা
// পোস্ট/মেসেজের নোটিফিকেশন আলাদা জমে থাকে, ফোনের লঞ্চার সেই জমা সংখ্যাই আইকনে দেখায়
// (চ্যাট পুশে আগেও tag ছিল না)। অ্যাপ খুললে জমা নোটিফিকেশন মুছে সংখ্যা ০ করা পরের Play build-এর কাজ।
//
// 📱 (2026-11-15) ব্রডকাস্ট এখন লগইনহীন ডিভাইসেও যায় (device_push_tokens টেবিলের টোকেন, নতুন অ্যাপ থেকে):
//  - একই টোকেন দুই টেবিলে থাকলে একবারই যায় (Set দিয়ে ডুপ্লিকেট বাদ)।
//  - পোস্টদাতার নিজের ডিভাইস বাদ (তার টোকেন ধরে, কারণ লগইনহীন টেবিলে uid নেই)।
//  - যে ডিভাইস এই লিস্টিংয়েরই "পছন্দের গাড়ি" অ্যালার্ট পেয়েছে (last_alert_listing = এই লিস্টিং), সে বাদ,
//    যাতে একই গাড়ির দুটো নোটিফিকেশন না যায়।
//  - মৃত টোকেন (অ্যাপ মুছে ফেলা/মেয়াদ শেষ) device_push_tokens থেকে মুছে যায়।
const BD_UTC_OFFSET_HOURS = 6;
const QUIET_START_HOUR_BD = 24; // 24 = starts at 12:00 AM
const QUIET_END_HOUR_BD = 8;
const NEW_LISTING_MIN_GAP_MS = 30 * 60 * 1000;
const DEVICE_TOKEN_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

// 🖼️ (2026-11-13) নোটিফিকেশনে গাড়ির ছবি: লিস্টিংয়ের প্রথম https ছবি। ছবি বড় হলে বা না এলে
// অ্যান্ড্রয়েড ছবি ছাড়াই লেখা-সহ নোটিফিকেশন দেখায়, তাই এতে পুশ আটকায় না।
const pickPushImage = (imgs: any): string | undefined => {
  if (!Array.isArray(imgs)) return undefined;
  const u = imgs.find((s: any) => typeof s === "string" && /^https:\/\//.test(s));
  return u || undefined;
};

// 🔧 (2026-09-30) `supabase: any` here (was `ReturnType<typeof createClient>`)
// -- a newer @supabase/supabase-js got pulled in by an unrelated npm install
// and now infers `never` row/arg types for any client created without an
// explicit generated Database type (which this project doesn't have). That
// broke the build here and in rateLimit.ts/cron/maintenance.ts. `any` is the
// pragmatic fix until this project generates and wires up real Database
// types; functionally identical to before, just without the stricter
// (currently unusable) compile-time checking.
export async function sendPushToUid(
  supabase: any,
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  // 🔔 (2026-11-22) অ্যাপের 🔔 ইনবক্সের জন্য: চ্যাট/পোস্ট-সংক্রান্ত ব্যক্তিগত পুশ টেবিলে জমা থাকে
  // (টোকেন না থাকলেও, যাতে অ্যাপ খুললে তালিকায় দেখা যায়)। লেখা ব্যর্থ হলেও পুশ আটকায় না।
  if (data && (data.chatId || data.listingId)) {
    try {
      const { error: inboxErr } = await supabase.from("user_notifications").insert({
        uid,
        kind: data.chatId ? "chat" : "listing",
        title,
        body,
        chat_id: data.chatId || null,
        listing_id: data.listingId || null,
      });
      if (inboxErr) console.warn("user_notifications insert failed:", inboxErr.message);
    } catch (e: any) {
      console.warn("user_notifications insert error:", e?.message || e);
    }
  }
  const { data: row, error } = await supabase.from("users").select("fcm_token").eq("uid", uid).maybeSingle();
  if (error || !row?.fcm_token) return false;
  try {
    await sendSmart(supabase, {
      token: row.fcm_token as string,
      notification: { title, body },
      data: data || {},
    });
    return true;
  } catch (e: any) {
    console.warn("sendPushToUid failed:", e?.message || e);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!getApps().length) {
    return res.status(500).json({ error: "Push notifications are not configured on the server." });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    // 🔔 (2026-11-08) ডেটাবেস থেকে আসা অভ্যন্তরীণ কল (Supabase pg_net + গোপন চাবি):
    //  ক) কেউ কোনো লিস্টিংয়ের কল বাটনে চাপলে শুধু ওই বিক্রেতার ফোনে পুশ।
    //  খ) চ্যাটে নতুন মেসেজ ঢুকলেই (chat_messages-এ insert হলেই) অপর পক্ষের ফোনে পুশ --
    //     সেন্ডারের অ্যাপের ভার্সন বা নেটওয়ার্কের ওপর নির্ভর না করে।
    // চাবিটা শুধু Supabase Vault-এ আছে; এখানে সেটা check_push_secret() দিয়ে যাচাই হয়, তাই
    // কোডে বা Vercel env-এ আলাদা কপি রাখতে হয়নি। ব্রাউজার থেকে এই পথ খোলা যায় না।
    const internalSecret = req.headers["x-internal-secret"];
    if (internalSecret) {
      const { data: secretOk } = await supabase.rpc("check_push_secret", { s: String(internalSecret) });
      if (secretOk !== true) {
        return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
      }

      // 🔔 (2026-11-11) গ) নতুন লিস্টিং এলে, যেসব লগইনহীন ডিভাইসের পছন্দের (ব্র্যান্ড/মডেল) সাথে মেলে
      //    (ডেটাবেসের notify_matching_devices ট্রিগার বেছে দেয়, দিনে ৩টা ও দুই পুশের মাঝে ২ ঘণ্টার সীমাসহ)
      //    শুধু তাদের টোকেনে পুশ। টোকেন device_push_tokens টেবিলে (register_device_push দিয়ে জমা)।
      const deviceAlert = (req.body || {}).internalDeviceAlert;
      if (deviceAlert) {
        const ids: string[] = Array.isArray(deviceAlert.deviceIds)
          ? deviceAlert.deviceIds.map((x: any) => String(x)).filter(Boolean)
          : [];
        if (!deviceAlert.listingId || ids.length === 0) {
          return res.status(400).json({ error: "তথ্য অসম্পূর্ণ।" });
        }
        const { data: lst } = await supabase
          .from("listings")
          .select("id, title, price, images, is_deleted, is_sold")
          .eq("id", deviceAlert.listingId)
          .maybeSingle();
        if (!lst || lst.is_deleted || lst.is_sold) {
          return res.status(200).json({ success: true, skipped: "listing_unavailable" });
        }
        const devs: any[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          const { data: part } = await supabase
            .from("device_push_tokens")
            .select("device_id, fcm_token")
            .in("device_id", ids.slice(i, i + 100));
          if (part) devs.push(...part);
        }
        const rows = devs.filter((r: any) => r.fcm_token);
        const priceTxt = Number(lst.price) > 0 ? " - ৳" + Number(lst.price).toLocaleString("en-IN") : "";
        const alertImage = pickPushImage(lst.images);
        let sentCount = 0;
        const deadDevices: string[] = [];
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const r = await sendMulticastSmart(supabase, {
            tokens: batch.map((x: any) => x.fcm_token as string),
            notification: {
              title: "আপনার পছন্দের গাড়ি এসেছে 🚗",
              body: String(lst.title || "").slice(0, 80) + priceTxt,
              ...(alertImage ? { imageUrl: alertImage } : {}),
            },
            data: { listingId: String(lst.id) },
          });
          sentCount += r.successCount;
          r.responses.forEach((resp: any, idx: number) => {
            const code = String(resp?.error?.code || "");
            if (!resp.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
              deadDevices.push(batch[idx].device_id);
            }
          });
        }
        // অ্যাপ মুছে ফেলা/মেয়াদ শেষ টোকেন পরিষ্কার
        for (let i = 0; i < deadDevices.length; i += 100) {
          await supabase.from("device_push_tokens").delete().in("device_id", deadDevices.slice(i, i + 100));
        }
        return res.status(200).json({ success: true, sent: sentCount });
      }

      // 🌅 (2026-11-26) সকালের ফ্লাশ: রাতে (১২টা–৮টা) পাঠানো যায়নি এমন খবর সকালে পাঠানো।
      //  জমা থাকে pending_morning_pushes টেবিলে; ডেটাবেসের cron "flush-morning-pushes" রোজ ৮:০৫-এ ডাকে।
      //  ক) রাতে কেউ বিক্রেতার পোস্টে কল বাটনে চেপেছিল -> বিক্রেতাকে একটাই পুশ (একাধিক পোস্ট হলে সংখ্যাসহ)
      //  খ) রাতে নতুন বিজ্ঞাপন এসেছিল -> সবার কাছে একটাই সারসংক্ষেপ ("রাতে N টি নতুন বিজ্ঞাপন এসেছে")
      //  dryRun: true দিলে কিছু পাঠায়/মোছে না, শুধু সংখ্যা ফেরত দেয় (টেস্টের জন্য)।
      const morning = (req.body || {}).internalMorningFlush;
      if (morning) {
        const dryRun = morning.dryRun === true;
        const { data: pendRows } = await supabase
          .from("pending_morning_pushes")
          .select("id, kind, listing_id")
          .order("created_at", { ascending: true })
          .limit(2000);
        const pending: any[] = pendRows || [];
        if (pending.length === 0) {
          return res.status(200).json({ success: true, dryRun, sellerPushes: 0, summarySent: 0, listings: 0 });
        }
        const pendIds = Array.from(new Set(pending.map((p: any) => String(p.listing_id))));
        const alive = new Map<string, any>();
        for (let i = 0; i < pendIds.length; i += 100) {
          const { data: ls } = await supabase
            .from("listings")
            .select("id, title, price, images, seller_id, is_deleted, is_sold, created_at")
            .in("id", pendIds.slice(i, i + 100));
          (ls || []).forEach((x: any) => {
            if (!x.is_deleted && !x.is_sold) alive.set(String(x.id), x);
          });
        }

        // ক) বিক্রেতার কল
        const bySeller = new Map<string, any[]>();
        pending
          .filter((p: any) => p.kind === "seller_call")
          .forEach((p: any) => {
            const l = alive.get(String(p.listing_id));
            if (!l || !l.seller_id) return;
            const arr = bySeller.get(l.seller_id) || [];
            arr.push(l);
            bySeller.set(l.seller_id, arr);
          });
        let sellerPushes = 0;
        for (const [sellerId, ls] of Array.from(bySeller.entries())) {
          if (dryRun) {
            sellerPushes++;
            continue;
          }
          const first = ls[0];
          const titleTxt = String(first.title || "").slice(0, 60);
          const okSeller = await sendPushToUid(
            supabase,
            sellerId,
            ls.length > 1 ? "রাতে কয়েকজন আপনার পোস্টে আগ্রহী ছিলেন 📞" : "রাতে কেউ আপনার পোস্টে আগ্রহী ছিলেন 📞",
            ls.length > 1
              ? `${ls.length}টি পোস্টে কল বাটনে চাপ পড়েছে। ফোন ধরার জন্য তৈরি থাকুন।`
              : `"${titleTxt}" দেখে একজন কল বাটনে চেপেছিলেন। ফোন ধরার জন্য তৈরি থাকুন।`,
            { listingId: String(first.id) }
          );
          if (okSeller) sellerPushes++;
        }

        // খ) রাতের নতুন বিজ্ঞাপনের সারসংক্ষেপ
        const nightNew: any[] = pending
          .filter((p: any) => p.kind === "new_listing")
          .map((p: any) => alive.get(String(p.listing_id)))
          .filter(Boolean);
        let summarySent = 0;
        if (nightNew.length > 0 && !dryRun) {
          nightNew.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const newest = nightNew[0];
          const nNew = nightNew.length;
          const sumTokens = new Set<string>();
          for (let from = 0; from < 5000; from += 1000) {
            const { data: rows } = await supabase
              .from("users")
              .select("fcm_token")
              .not("fcm_token", "is", null)
              .range(from, from + 999);
            (rows || []).forEach((r: any) => {
              if (r.fcm_token) sumTokens.add(r.fcm_token);
            });
            if (!rows || rows.length < 1000) break;
          }
          const sumDevByToken = new Map<string, string>();
          const sumFresh = new Date(Date.now() - DEVICE_TOKEN_MAX_AGE_MS).toISOString();
          for (let from = 0; from < 10000; from += 1000) {
            const { data: rows } = await supabase
              .from("device_push_tokens")
              .select("device_id, fcm_token")
              .gt("updated_at", sumFresh)
              .range(from, from + 999);
            (rows || []).forEach((r: any) => {
              if (r.fcm_token) {
                sumTokens.add(r.fcm_token);
                sumDevByToken.set(r.fcm_token, r.device_id);
              }
            });
            if (!rows || rows.length < 1000) break;
          }
          const sumList = Array.from(sumTokens);
          const sumPrice = Number(newest.price) > 0 ? " - ৳" + Number(newest.price).toLocaleString("en-IN") : "";
          const sumImage = pickPushImage(newest.images);
          const sumDead: string[] = [];
          for (let i = 0; i < sumList.length; i += 500) {
            const batch = sumList.slice(i, i + 500);
            const r = await sendMulticastSmart(supabase, {
              tokens: batch,
              notification: {
                title: nNew > 1 ? `রাতে ${nNew}টি নতুন বিজ্ঞাপন এসেছে 🌅` : "রাতে একটি নতুন বিজ্ঞাপন এসেছে 🌅",
                body: String(newest.title || "").slice(0, 80) + sumPrice,
                ...(sumImage ? { imageUrl: sumImage } : {}),
              },
              data: { listingId: String(newest.id) },
            });
            summarySent += r.successCount;
            r.responses.forEach((resp: any, idx: number) => {
              const code = String(resp?.error?.code || "");
              const dev = sumDevByToken.get(batch[idx]);
              if (!resp.success && dev && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
                sumDead.push(dev);
              }
            });
          }
          for (let i = 0; i < sumDead.length; i += 100) {
            await supabase.from("device_push_tokens").delete().in("device_id", sumDead.slice(i, i + 100));
          }
        }
        if (!dryRun) {
          const doneIds = pending.map((p: any) => p.id);
          for (let i = 0; i < doneIds.length; i += 200) {
            await supabase.from("pending_morning_pushes").delete().in("id", doneIds.slice(i, i + 200));
          }
        }
        return res.status(200).json({ success: true, dryRun, sellerPushes, summarySent, listings: nightNew.length });
      }

      const soldPush = (req.body || {}).internalSoldPush;
      if (soldPush) {
        if (!soldPush.listingId) {
          return res.status(400).json({ error: "তথ্য অসম্পূর্ণ।" });
        }
        const soldHourBd = (new Date().getUTCHours() + BD_UTC_OFFSET_HOURS) % 24;
        if (soldHourBd < QUIET_END_HOUR_BD) {
          return res.status(200).json({ success: true, skipped: "quiet_hours" });
        }
        const { data: sl } = await supabase
          .from("listings")
          .select("id, title, seller_id, images, is_sold, is_deleted")
          .eq("id", soldPush.listingId)
          .maybeSingle();
        if (!sl || !sl.is_sold || sl.is_deleted) {
          return res.status(200).json({ success: true, skipped: "not_sold" });
        }
        const { data: sellerRow } = await supabase.from("users").select("fcm_token").eq("uid", sl.seller_id).maybeSingle();
        const sellerToken: string | null = sellerRow?.fcm_token || null;
        const soldTokens = new Set<string>();
        for (let from = 0; from < 5000; from += 1000) {
          const { data: rows } = await supabase
            .from("users")
            .select("fcm_token")
            .not("fcm_token", "is", null)
            .neq("uid", sl.seller_id)
            .range(from, from + 999);
          (rows || []).forEach((r: any) => {
            if (r.fcm_token) soldTokens.add(r.fcm_token);
          });
          if (!rows || rows.length < 1000) break;
        }
        const soldDeviceByToken = new Map<string, string>();
        const soldFresh = new Date(Date.now() - DEVICE_TOKEN_MAX_AGE_MS).toISOString();
        for (let from = 0; from < 10000; from += 1000) {
          const { data: rows } = await supabase
            .from("device_push_tokens")
            .select("device_id, fcm_token")
            .gt("updated_at", soldFresh)
            .range(from, from + 999);
          (rows || []).forEach((r: any) => {
            if (r.fcm_token) {
              soldTokens.add(r.fcm_token);
              soldDeviceByToken.set(r.fcm_token, r.device_id);
            }
          });
          if (!rows || rows.length < 1000) break;
        }
        if (sellerToken) soldTokens.delete(sellerToken);
        const soldList = Array.from(soldTokens);
        const soldImage = pickPushImage(sl.images);
        let soldSent = 0;
        const soldDead: string[] = [];
        for (let i = 0; i < soldList.length; i += 500) {
          const batch = soldList.slice(i, i + 500);
          const r = await sendMulticastSmart(supabase, {
            tokens: batch,
            notification: {
              title: "🎉 বিক্রি হয়ে গেছে!",
              body: String(sl.title || "").slice(0, 70) + " — Garibazar-এ বিক্রি হলো। আপনিও পোস্ট করুন",
              ...(soldImage ? { imageUrl: soldImage } : {}),
            },
            data: { listingId: String(sl.id) },
          });
          soldSent += r.successCount;
          r.responses.forEach((resp: any, idx: number) => {
            const code = String(resp?.error?.code || "");
            const dev = soldDeviceByToken.get(batch[idx]);
            if (!resp.success && dev && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
              soldDead.push(dev);
            }
          });
        }
        for (let i = 0; i < soldDead.length; i += 100) {
          await supabase.from("device_push_tokens").delete().in("device_id", soldDead.slice(i, i + 100));
        }
        return res.status(200).json({ success: true, sent: soldSent });
      }

      const chatPush = (req.body || {}).internalChatPush;
      if (chatPush) {
        const c = chatPush;
        if (!c.chatId || !c.toUid || !c.fromUid || c.toUid === c.fromUid) {
          return res.status(400).json({ error: "তথ্য অসম্পূর্ণ।" });
        }
        const { data: chat } = await supabase
          .from("chats")
          .select("buyer_id, seller_id, participant_a, participant_b")
          .eq("id", c.chatId)
          .maybeSingle();
        const members = chat
          ? [chat.buyer_id, chat.seller_id, chat.participant_a, chat.participant_b].filter(Boolean)
          : [];
        if (!chat || !members.includes(c.toUid) || !members.includes(c.fromUid)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        const sentChat = await sendPushToUid(
          supabase,
          String(c.toUid),
          String(c.senderName || "নতুন মেসেজ").slice(0, 60),
          String(c.text || "").trim().slice(0, 120) || "আপনাকে একটি মেসেজ পাঠানো হয়েছে",
          { chatId: String(c.chatId) }
        );
        return res.status(200).json({ success: true, sent: sentChat });
      }

      const call = (req.body || {}).internalSellerCall;
      if (!call?.uid || !call?.listingId) {
        return res.status(400).json({ error: "তথ্য অসম্পূর্ণ।" });
      }
      const { data: lst } = await supabase
        .from("listings")
        .select("id, title, seller_id")
        .eq("id", call.listingId)
        .maybeSingle();
      if (!lst || lst.seller_id !== call.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const titleTxt = String(lst.title || "").slice(0, 60);
      const sentToSeller = await sendPushToUid(
        supabase,
        lst.seller_id,
        "কেউ আপনার পোস্টে আগ্রহী! 📞",
        `"${titleTxt}" দেখে একজন কল বাটনে চেপেছেন। ফোন ধরার জন্য তৈরি থাকুন।`,
        { listingId: String(lst.id) }
      );
      return res.status(200).json({ success: true, sent: sentToSeller });
    }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    const uid = await verifySupabaseToken(idToken);
    if (!uid) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }

    const { listingId } = req.body || {};
    if (listingId) {
      const { data: l } = await supabase
        .from("listings")
        .select("id, title, price, seller_id, images")
        .eq("id", listingId)
        .maybeSingle();
      if (!l || l.seller_id !== uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // রাতে ঘুমের সময় কোনো ব্রডকাস্ট নয় -- এখানে থেমে গেলে ৩০ মিনিটের ঘড়ি ছোঁয়া হয় না।
      const bdHour = (new Date().getUTCHours() + BD_UTC_OFFSET_HOURS) % 24;
      if (bdHour >= QUIET_START_HOUR_BD || bdHour < QUIET_END_HOUR_BD) {
        // 🌅 রাতে পাঠানো না গেলেও সকালের সারসংক্ষেপের জন্য জমিয়ে রাখা (সকাল ৮:০৫-এ একটাই পুশ)
        try {
          await supabase
            .from("pending_morning_pushes")
            .upsert({ kind: "new_listing", listing_id: l.id, seller_id: uid }, { onConflict: "kind,listing_id", ignoreDuplicates: true });
        } catch (_) {}
        return res.status(200).json({ success: true, skipped: "quiet_hours" });
      }

      const cutoff = new Date(Date.now() - NEW_LISTING_MIN_GAP_MS).toISOString();
      const { data: claimed } = await supabase
        .from("push_throttle")
        .update({ last_sent: new Date().toISOString() })
        .eq("key", "new_listing")
        .lt("last_sent", cutoff)
        .select("key");
      if (!claimed || claimed.length === 0) {
        return res.status(200).json({ success: true, skipped: true });
      }

      // পোস্টদাতার নিজের ফোনের টোকেন (লগইনহীন টেবিলে uid নেই, তাই টোকেন ধরে বাদ দিতে হবে)
      const { data: posterRow } = await supabase.from("users").select("fcm_token").eq("uid", uid).maybeSingle();
      const posterToken: string | null = posterRow?.fcm_token || null;

      const tokens = new Set<string>();
      for (let from = 0; from < 5000; from += 1000) {
        const { data: rows } = await supabase
          .from("users")
          .select("fcm_token")
          .not("fcm_token", "is", null)
          .neq("uid", uid)
          .range(from, from + 999);
        (rows || []).forEach((r: any) => {
          if (r.fcm_token) tokens.add(r.fcm_token);
        });
        if (!rows || rows.length < 1000) break;
      }

      // 📱 লগইনহীন ডিভাইস (নতুন অ্যাপ): এই লিস্টিংয়ের "পছন্দের গাড়ি" অ্যালার্ট যারা পেয়েছে তারা বাদ
      const deviceByToken = new Map<string, string>();
      const freshSince = new Date(Date.now() - DEVICE_TOKEN_MAX_AGE_MS).toISOString();
      for (let from = 0; from < 10000; from += 1000) {
        const { data: rows } = await supabase
          .from("device_push_tokens")
          .select("device_id, fcm_token")
          .gt("updated_at", freshSince)
          .or(`last_alert_listing.is.null,last_alert_listing.neq.${l.id}`)
          .range(from, from + 999);
        (rows || []).forEach((r: any) => {
          if (r.fcm_token) {
            tokens.add(r.fcm_token);
            deviceByToken.set(r.fcm_token, r.device_id);
          }
        });
        if (!rows || rows.length < 1000) break;
      }
      if (posterToken) tokens.delete(posterToken);

      const list = Array.from(tokens);
      const priceTxt =
        Number(l.price) > 0 ? " - ৳" + Number(l.price).toLocaleString("en-IN") : "";
      const broadcastImage = pickPushImage(l.images);
      let sentCount = 0;
      const deadDevices: string[] = [];
      for (let i = 0; i < list.length; i += 500) {
        const batch = list.slice(i, i + 500);
        const r = await sendMulticastSmart(supabase, {
          tokens: batch,
          notification: {
            title: "নতুন বিজ্ঞাপন",
            body: String(l.title || "").slice(0, 80) + priceTxt,
            ...(broadcastImage ? { imageUrl: broadcastImage } : {}),
          },
          data: { listingId: String(l.id) },
        });
        sentCount += r.successCount;
        r.responses.forEach((resp: any, idx: number) => {
          const code = String(resp?.error?.code || "");
          const dev = deviceByToken.get(batch[idx]);
          if (!resp.success && dev && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) {
            deadDevices.push(dev);
          }
        });
      }
      // মৃত টোকেন পরিষ্কার (একসাথে বেশি আইডি দিলে ঠিকানা লম্বা হয়, তাই ১০০টা করে)
      for (let i = 0; i < deadDevices.length; i += 100) {
        await supabase.from("device_push_tokens").delete().in("device_id", deadDevices.slice(i, i + 100));
      }
      return res.status(200).json({ success: true, sent: sentCount });
    }

    // 💬 (2026-11-08) চ্যাট মেসেজের পুশ এখন ডেটাবেস নিজেই পাঠায় (chat_messages-এ insert হলেই,
    // উপরের internalChatPush পথে)। অ্যাপ (সেন্ডার) এখনো এই পথে কল করে, তাই একই মেসেজের জন্য
    // দ্বিতীয় নোটিফিকেশন যেন না যায় সেজন্য এখানে চুপচাপ থামানো হলো।
    const { chatId: legacyChatId } = req.body || {};
    if (legacyChatId) {
      return res.status(200).json({ success: true, skipped: "handled_by_database" });
    }

    const { title, body } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "title ও body পাঠাতে হবে।" });
    }

    const sent = await sendPushToUid(
      supabase,
      uid,
      String(title).slice(0, 60),
      String(body).slice(0, 120)
    );
    if (!sent) {
      return res.status(404).json({ error: "এই ডিভাইসে পুশ নোটিফিকেশন রেজিস্টার্ড করা নেই।" });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("send-push failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
}
