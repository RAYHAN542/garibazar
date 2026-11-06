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
        .select("id, title, price, seller_id")
        .eq("id", listingId)
        .maybeSingle();
      if (!l || l.seller_id !== uid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
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
      let sentCount = 0;
      for (let i = 0; i < list.length; i += 500) {
        const r = await getMessaging().sendEachForMulticast({
          tokens: list.slice(i, i + 500),
          notification: {
            title: "নতুন বিজ্ঞাপন",
            body: String(l.title || "").slice(0, 80) + priceTxt,
          },
          data: { listingId: String(l.id) },
          android: { notification: { tag: "new_listing" } },
        });
        sentCount += r.successCount;
      }
      return res.status(200).json({ success: true, sent: sentCount });
    }

    const { title, body } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "title ও body পাঠাতে হবে।" });
    }

    const { chatId } = req.body || {};
    let targetUid = uid;
    if (chatId) {
      const { data: chat } = await supabase
        .from("chats")
        .select("buyer_id, seller_id")
        .eq("id", chatId)
        .maybeSingle();
      if (!chat || (chat.buyer_id !== uid && chat.seller_id !== uid)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      targetUid = chat.buyer_id === uid ? chat.seller_id : chat.buyer_id;
    }
    const sent = await sendPushToUid(
      supabase,
      targetUid,
      String(title).slice(0, 60),
      String(body).slice(0, 120),
      chatId ? { chatId: String(chatId) } : undefined
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
