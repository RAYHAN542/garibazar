import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
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
const BD_UTC_OFFSET_HOURS = 6;
const QUIET_START_HOUR_BD = 24; // 24 = starts at 12:00 AM
const QUIET_END_HOUR_BD = 8;
const NEW_LISTING_MIN_GAP_MS = 30 * 60 * 1000;

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
  const { data: row, error } = await supabase.from("users").select("fcm_token").eq("uid", uid).maybeSingle();
  if (error || !row?.fcm_token) return false;
  try {
    await getMessaging().send({
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
          ? deviceAlert.deviceIds.map((x: any) => String(x)).filter(Boolean).slice(0, 200)
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
        const { data: devs } = await supabase
          .from("device_push_tokens")
          .select("device_id, fcm_token")
          .in("device_id", ids);
        const rows = (devs || []).filter((r: any) => r.fcm_token);
        const priceTxt = Number(lst.price) > 0 ? " - ৳" + Number(lst.price).toLocaleString("en-IN") : "";
        const alertImage = pickPushImage(lst.images);
        let sentCount = 0;
        const deadDevices: string[] = [];
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const r = await getMessaging().sendEachForMulticast({
            tokens: batch.map((x: any) => x.fcm_token as string),
            notification: {
              title: "আপনার পছন্দের গাড়ি এসেছে 🚗",
              body: String(lst.title || "").slice(0, 80) + priceTxt,
              ...(alertImage ? { imageUrl: alertImage } : {}),
            },
            data: { listingId: String(lst.id) },
            android: { notification: { tag: "device_alert" } },
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
        if (deadDevices.length > 0) {
          await supabase.from("device_push_tokens").delete().in("device_id", deadDevices);
        }
        return res.status(200).json({ success: true, sent: sentCount });
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
      const list = Array.from(tokens);
      const priceTxt =
        Number(l.price) > 0 ? " - ৳" + Number(l.price).toLocaleString("en-IN") : "";
      const broadcastImage = pickPushImage(l.images);
      let sentCount = 0;
      for (let i = 0; i < list.length; i += 500) {
        const r = await getMessaging().sendEachForMulticast({
          tokens: list.slice(i, i + 500),
          notification: {
            title: "নতুন বিজ্ঞাপন",
            body: String(l.title || "").slice(0, 80) + priceTxt,
            ...(broadcastImage ? { imageUrl: broadcastImage } : {}),
          },
          data: { listingId: String(l.id) },
          android: { notification: { tag: "new_listing" } },
        });
        sentCount += r.successCount;
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
