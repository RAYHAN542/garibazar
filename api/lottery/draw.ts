import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomInt } from "crypto";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount),
      });
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

// জেতার সম্ভাবনা ঠিক ১০০ জনের মধ্যে ১ জন (১%)। ক্রিপ্টো-সিকিউর random ব্যবহার করা হচ্ছে
// যাতে ক্লায়েন্ট সাইড থেকে ম্যানিপুলেট করা সম্ভব না হয় — পুরো ড্র সার্ভারেই হয়।
const WIN_CHANCE_DENOMINATOR = 100;
const BOOST_DURATION_HOURS = 24;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    // 1. Verify the caller is a signed-in user
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "কোন প্রোডাক্টটি বুস্ট করতে চান, সেটি সিলেক্ট করুন।" });
    }

    const db = getFirestore();
    const today = getTodayInDhaka();

    // 2. Enforce one draw per user per day
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};

    if (userData.lastLotteryDate === today) {
      return res.status(429).json({
        error: "আজকের লটারি ইতিমধ্যে ব্যবহার করেছেন। আগামীকাল আবার চেষ্টা করুন।",
        alreadyUsedToday: true,
      });
    }

    // 3. Validate the listing belongs to this user and isn't already boosted
    const listingRef = db.collection("listings").doc(listingId);
    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) {
      return res.status(404).json({ error: "প্রোডাক্টটি খুঁজে পাওয়া যায়নি।" });
    }
    const listing = listingSnap.data() as any;
    if (listing.sellerId !== uid) {
      return res.status(403).json({ error: "এই প্রোডাক্টটি আপনার নয়।" });
    }
    if (listing.isAd) {
      return res.status(400).json({ error: "এই প্রোডাক্টটি ইতিমধ্যে বিজ্ঞাপন হিসেবে লাইভ আছে।" });
    }

    // 4. Draw — exactly 1-in-100 (1%) chance, server-side crypto RNG
    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR); // 0..99
    const win = roll === 0;

    const batch = db.batch();

    // Always mark today's draw as used, regardless of outcome
    batch.set(userRef, { lastLotteryDate: today }, { merge: true });

    let adExpiresAt: string | null = null;
    if (win) {
      adExpiresAt = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      batch.update(listingRef, {
        isAd: true,
        adTier: "featured",
        adExpiresAt,
      });
    }

    // Audit trail for admin visibility
    const drawRef = db.collection("lottery_draws").doc();
    batch.set(drawRef, {
      uid,
      listingId,
      listingTitle: listing.title || "",
      win,
      date: today,
      createdAt: new Date().toISOString(),
    });

    await batch.commit();

    return res.status(200).json({ win, adExpiresAt });
  } catch (err: any) {
    console.error("lottery draw failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
}
