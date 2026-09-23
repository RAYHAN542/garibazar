import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";
import { applyCors } from "./_lib/cors.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";

// 🔧 (2026-09-24) এই এন্ডপয়েন্ট আগে সম্পূর্ণ Firebase+Firestore নির্ভর ছিল --
// auth টোকেন শুধু Firebase হিসেবে যাচাই হতো (Supabase দিয়ে লগইন করা
// ইউজারদের জন্য সবসময় ব্যর্থ হতো), আর users/listings/lottery_draws সবই
// Firestore থেকে পড়া হতো, যেখানে migration-এর পর এগুলো Supabase-এ থাকে --
// তাই migration-পরবর্তী কোনো listing-ই খুঁজে পেত না। এখন
// api/get-seller-contact.ts ও api/payment/create-charge.ts-এর মতো auth
// Supabase টোকেন (Firebase fallback সহ) আর ডেটা Supabase থেকে পড়া/লেখা হয়।
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

// একজন ইউজার দিনে একবারই ঘুরাতে পারবে — বাংলাদেশ টাইমজোন (Asia/Dhaka) অনুযায়ী "আজ" নির্ধারণ করা হয়,
// যাতে মধ্যরাতে UTC/BD টাইমের গ্যাপে কেউ দুইবার সুযোগ না পায়।
const getTodayInDhaka = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // YYYY-MM-DD
};

// জেতার সম্ভাবনা ঠিক ১০ জনের মধ্যে ১ জন (১০%)। ক্রিপ্টো-সিকিউর random ব্যবহার করা হচ্ছে
// যাতে ক্লায়েন্ট সাইড থেকে ম্যানিপুলেট করা সম্ভব না হয় — পুরো ড্র সার্ভারেই হয়।
const WIN_CHANCE_DENOMINATOR = 10;
const BOOST_DURATION_HOURS = 24;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify the caller is signed in -- Supabase session first, legacy
    // Firebase ID token as a fallback for any still-cached old session.
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }
    let uid: string | null = await verifySupabaseToken(idToken);
    if (!uid && getApps().length) {
      try {
        const decoded = await getAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch {
        // fall through -- uid stays null, handled below
      }
    }
    if (!uid) {
      return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "কোন প্রোডাক্টটি বুস্ট করতে চান, সেটি সিলেক্ট করুন।" });
    }

    const today = getTodayInDhaka();

    // 2. Enforce one draw per user per day
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("last_lottery_date")
      .eq("uid", uid)
      .maybeSingle();
    if (userErr) {
      console.error("lottery draw: users lookup error:", userErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    }
    if (userRow?.last_lottery_date === today) {
      return res.status(429).json({
        error: "আজকের লটারি ইতিমধ্যে ব্যবহার করেছেন। আগামীকাল আবার চেষ্টা করুন।",
        alreadyUsedToday: true,
      });
    }

    // 3. Validate the listing belongs to this user and isn't already boosted.
    // Matches by id or legacy_firestore_id, same lookup pattern as
    // api/get-seller-contact.ts, so pre- and post-migration listing IDs
    // both resolve correctly.
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(listingId);
    const { data: listingRow, error: listingErr } = await supabase
      .from("listings")
      .select("id, seller_id, title, is_ad")
      .or(isUuid ? `legacy_firestore_id.eq.${listingId},id.eq.${listingId}` : `legacy_firestore_id.eq.${listingId}`)
      .maybeSingle();
    if (listingErr) {
      console.error("lottery draw: listings lookup error:", listingErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    }
    if (!listingRow) {
      return res.status(404).json({ error: "প্রোডাক্টটি খুঁজে পাওয়া যায়নি।" });
    }
    if (listingRow.seller_id !== uid) {
      return res.status(403).json({ error: "এই প্রোডাক্টটি আপনার নয়।" });
    }
    if (listingRow.is_ad) {
      return res.status(400).json({ error: "এই প্রোডাক্টটি ইতিমধ্যে বিজ্ঞাপন হিসেবে লাইভ আছে।" });
    }

    // 4. Draw — exactly 1-in-10 (10%) chance, server-side crypto RNG
    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR); // 0..9
    const win = roll === 0;

    let adExpiresAt: string | null = null;
    if (win) {
      adExpiresAt = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      const { error: boostErr } = await supabase
        .from("listings")
        .update({ is_ad: true, ad_tier: "featured", ad_expires_at: adExpiresAt })
        .eq("id", listingRow.id);
      if (boostErr) {
        console.error("lottery draw: failed to apply boost:", boostErr.message);
        return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
      }
    }

    // Always mark today's draw as used, regardless of outcome
    const { error: markUsedErr } = await supabase
      .from("users")
      .update({ last_lottery_date: today })
      .eq("uid", uid);
    if (markUsedErr) {
      console.error("lottery draw: failed to mark today used:", markUsedErr.message);
    }

    // Audit trail for admin visibility
    const { error: auditErr } = await supabase.from("lottery_draws").insert({
      uid,
      data: {
        listingId: listingRow.id,
        listingTitle: listingRow.title || "",
        win,
        date: today,
        createdAt: new Date().toISOString(),
      },
    });
    if (auditErr) {
      console.error("lottery draw: failed to write audit row:", auditErr.message);
    }

    return res.status(200).json({ win, adExpiresAt });
  } catch (err: any) {
    console.error("lottery draw failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
}
