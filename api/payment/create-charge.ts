import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../_lib/cors.js";
import { verifySupabaseToken } from "../_lib/verifyJwt.js";

// 🔧 (2026-09-23) এই এন্ডপয়েন্ট আগে সম্পূর্ণ Firebase+Firestore নির্ভর ছিল --
// auth টোকেন Firebase-only যাচাই হতো (Supabase দিয়ে লগইন করা ইউজারদের জন্য
// সবসময় ব্যর্থ হতো), আর refill_requests/listings/users সবই Firestore থেকে
// পড়া হতো, যেখানে migration-এর পর এগুলো Supabase-এ থাকে। ফলাফল: প্রায়
// কারো জন্যই "Ad Promote" পেমেন্ট কাজ করত না। এখন auth Supabase টোকেন
// (Firebase fallback সহ) আর ডেটা Supabase থেকে পড়া হয়।
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

const SITE_URL = "https://garibazar.shop";

// সার্ভার-সাইড দামের তালিকা -- src/translations.ts-এর AD_PACKAGES-এর সাথে
// হুবহু মিলিয়ে রাখতে হবে (দাম বদলালে দুই জায়গাতেই বদলাতে হবে)। ক্লায়েন্ট
// থেকে পাঠানো amount/adTier/durationDays আগে সরাসরি বিশ্বাস করে UddoktaPay-কে
// পাঠানো হতো -- কেউ চাইলে ব্রাউজার কনসোল থেকে সরাসরি ডাটাবেসে
// amount:1, adTier:"featured", durationDays:30 লিখে মাত্র ৳১ দিয়ে ৩০ দিনের
// প্রোমোশন কিনে ফেলতে পারত। এখন adTier+durationDays-এর জন্য সঠিক দাম না
// মিললে চার্জ তৈরিই হবে না।
const AD_PACKAGE_PRICES: Record<string, { durationDays: number; price: number }> = {
  basic: { durationDays: 2, price: 100 },
  premium: { durationDays: 4, price: 200 },
  featured: { durationDays: 7, price: 300 },
};

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const baseUrl = process.env.UDDOKTAPAY_BASE_URL;
    if (!apiKey || !baseUrl) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }

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
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
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

    // 2. Load the pending refill_request the user already created client-side
    const { requestId } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ error: "requestId প্রয়োজন।" });
    }

    const { data: request, error: reqErr } = await supabase
      .from("refill_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) {
      console.error("create-charge: refill_requests lookup error:", reqErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
    }
    if (!request) {
      return res.status(404).json({ error: "রিকোয়েস্ট খুঁজে পাওয়া যায়নি।" });
    }
    if (request.user_id !== uid) {
      return res.status(403).json({ error: "এই রিকোয়েস্ট আপনার নয়।" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "এই রিকোয়েস্টটি ইতিমধ্যে প্রসেস হয়ে গেছে।" });
    }
    const amount = Number(request.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "সঠিক পরিমাণ নেই।" });
    }

    // ad_promotion requests must match a real package's price+duration exactly --
    // wallet top-ups (type !== "ad_promotion") are exempt since any positive
    // top-up amount is legitimately user-chosen.
    if (request.type === "ad_promotion") {
      const canonical = AD_PACKAGE_PRICES[request.ad_tier];
      if (!canonical || canonical.durationDays !== Number(request.duration_days) || canonical.price !== amount) {
        console.error("create-charge: ad_promotion price/duration mismatch", {
          requestId, adTier: request.ad_tier, durationDays: request.duration_days, amount,
        });
        return res.status(400).json({ error: "প্যাকেজের তথ্য মেলেনি। অনুগ্রহ করে আবার চেষ্টা করুন।" });
      }

      // The request being for THIS user's own account isn't enough on its
      // own - also confirm the listing being promoted actually belongs to
      // them, otherwise someone could pay to promote a listing that isn't
      // theirs by pointing listingId at someone else's.
      if (!request.listing_id) {
        return res.status(400).json({ error: "কোন লিস্টিং প্রোমোট করতে চান তা পাওয়া যায়নি।" });
      }
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .select("seller_id")
        .eq("id", request.listing_id)
        .maybeSingle();
      if (listingErr) {
        console.error("create-charge: listing lookup error:", listingErr.message);
        return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
      }
      if (!listingRow) {
        return res.status(404).json({ error: "লিস্টিংটি খুঁজে পাওয়া যায়নি।" });
      }
      if (listingRow.seller_id !== uid) {
        console.error("create-charge: ad_promotion ownership mismatch", {
          requestId, listingId: request.listing_id, uid,
        });
        return res.status(403).json({ error: "এই লিস্টিং আপনার নয়।" });
      }
    }

    // 3. Look up the user's profile for name/phone (used as billing info)
    const { data: userRow } = await supabase
      .from("users")
      .select("name, phone")
      .eq("uid", uid)
      .maybeSingle();
    const displayName = userRow?.name || "Gari Bazar User";
    const phoneNumber = userRow?.phone || "";
    // UddoktaPay requires an email; users in this app only have phone numbers, so synthesize one.
    const syntheticEmail = `${phoneNumber || uid}@garibazar.app`;

    // 4. Create the charge with UddoktaPay
    const checkoutUrl = new URL("api/checkout-v2", baseUrl).toString();
    const uddoktaRes = await fetch(checkoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({
        full_name: displayName,
        email: syntheticEmail,
        amount: String(amount),currency: "BDT",
        metadata: {
          requestId,
          uid,
        },
        redirect_url: `${SITE_URL}/?payment=success`,
        cancel_url: `${SITE_URL}/?payment=cancel`,
        webhook_url: `${SITE_URL}/api/payment/webhook`,
        return_type: "GET",
      }),
    });

    const uddoktaData = await uddoktaRes.json().catch(() => ({}));

    if (!uddoktaRes.ok || !uddoktaData?.payment_url) {
      console.error("UddoktaPay create-charge failed:", uddoktaData);
      return res.status(502).json({ error: "পেমেন্ট গেটওয়ে থেকে সাড়া পাওয়া যায়নি।" });
    }

    return res.status(200).json({ payment_url: uddoktaData.payment_url });
  } catch (err: any) {
    console.error("create-charge failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
}
