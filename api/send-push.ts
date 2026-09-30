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

export async function sendPushToUid(
  supabase: ReturnType<typeof createClient>,
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    const uid = await verifySupabaseToken(idToken);
    if (!uid) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }

    const { title, body } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ error: "title ও body পাঠাতে হবে।" });
    }

    const sent = await sendPushToUid(supabase, uid, title, body);
    if (!sent) {
      return res.status(404).json({ error: "এই ডিভাইসে পুশ নোটিফিকেশন রেজিস্টার্ড করা নেই।" });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("send-push failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
}
