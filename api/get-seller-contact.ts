import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { applyCors } from "./_lib/cors.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// "Show number" endpoint.
//
// 🔧 FIX (Firebase -> Supabase migration): আগে এই endpoint শুধুমাত্র
// Firebase ID token যাচাই করত। কিন্তু লগইন এখন Supabase (phone + password)
// দিয়ে হয়, তাই ব্রাউজারে কোনো Firebase session থাকে না -- ফলে পোস্টে ক্লিক
// করে "নম্বর দেখুন" চাপলে সবসময় 401 আসত এবং নম্বর দেখাত না।
// এখন প্রথমে Supabase access token যাচাই করা হয়, না মিললে পুরনো Firebase
// token fallback হিসেবে থাকে (পুরনো ক্লায়েন্ট version-এর জন্য)।
//
// Rate limit-ও Firestore থেকে Supabase-এর rate_limits টেবিলে সরানো হয়েছে,
// কারণ Firebase admin credential না থাকলে আগের rate limiter throw করত এবং
// সেটাও 401 হিসেবে ধরা পড়ত।
// ------------------------------------------------------------------------

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // reveals per user per hour

async function checkRateLimit(key: string): Promise<boolean> {
  if (!supabaseAdmin) return true;
  try {
    const now = new Date();
    const { data } = await supabaseAdmin.from("rate_limits").select("*").eq("key", key).maybeSingle();
    if (!data || now.getTime() - new Date(data.window_start).getTime() > RATE_LIMIT_WINDOW_MS) {
      await supabaseAdmin.from("rate_limits").upsert({ key, count: 1, window_start: now.toISOString() });
      return true;
    }
    const newCount = (data.count || 0) + 1;
    await supabaseAdmin.from("rate_limits").update({ count: newCount }).eq("key", key);
    return newCount <= RATE_LIMIT_MAX;
  } catch (e) {
    // rate limiter fail হলে ইউজারকে আটকানো হয় না, শুধু log করা হয়।
    console.error("[get-seller-contact] rate limit check failed:", e);
    return true;
  }
}

/** Supabase token আগে, তারপর Firebase token -- দুটোর একটাও না মিললে null। */
async function resolveCallerUid(token: string): Promise<string | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return data.user.id;
    } catch (e) {
      console.error("[get-seller-contact] supabase token check failed:", e);
    }
  }
  if (getApps().length) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.uid;
    } catch (e) {
      console.error("[get-seller-contact] firebase token check failed:", (e as any)?.message || e);
    }
  }
  return null;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
    }

    const callerUid = await resolveCallerUid(token);
    if (!callerUid) {
      return res.status(401).json({ error: "লগইন সেশন মেয়াদোত্তীর্ণ। আবার লগইন করুন।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "listingId প্রয়োজন।" });
    }

    const allowed = await checkRateLimit(`contact_reveal_${callerUid}`);
    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার নম্বর দেখার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    // 1) Supabase (নতুন এবং migrate করা listing) -- এটাই এখন প্রধান উৎস।
    if (supabaseAdmin) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(listingId);
      const { data: listingRow, error: listingErr } = await supabaseAdmin
        .from("listings")
        .select("id")
        .or(isUuid ? `id.eq.${listingId},legacy_firestore_id.eq.${listingId}` : `legacy_firestore_id.eq.${listingId}`)
        .maybeSingle();

      if (listingErr) {
        console.error("[get-seller-contact] Supabase lookup error:", listingErr.message);
      } else if (listingRow) {
        const { data: contactRow, error: contactErr } = await supabaseAdmin
          .from("listing_contacts")
          .select("phone")
          .eq("listing_id", listingRow.id)
          .maybeSingle();
        if (!contactErr && contactRow?.phone) {
          return res.status(200).json({ contactNumber: contactRow.phone });
        }
        if (contactErr) console.error("[get-seller-contact] contact lookup error:", contactErr.message);
      }
    } else {
      console.error("[get-seller-contact] Missing Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }

    // 2) পুরনো Firestore fallback (যদি এখনো Firebase credential থাকে)।
    if (getApps().length) {
      try {
        const contactSnap = await getFirestore()
          .collection("listings")
          .doc(listingId)
          .collection("private")
          .doc("contact")
          .get();
        if (contactSnap.exists && contactSnap.data()?.contactNumber) {
          return res.status(200).json({ contactNumber: contactSnap.data()?.contactNumber });
        }
      } catch (e) {
        console.error("[get-seller-contact] Firestore fallback failed:", (e as any)?.message || e);
      }
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(500).json({ error: "নম্বর আনা যায়নি। আবার চেষ্টা করুন।" });
  }
}
