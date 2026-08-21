import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

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

// একজন ইউজার সর্বোচ্চ কত দ্রুত পরপর নতুন Listing পোস্ট করতে পারবে, এবং দিনে
// সর্বোচ্চ কতগুলো — এই দুটো সীমা bot/spam প্রতিরোধের জন্য। এটা সার্ভারেই
// প্রয়োগ হয় (Firestore rules না), কারণ rules দিয়ে "এই write-এর সাথে
// rate-limit ডকুমেন্টও আপডেট হতে হবে" এই বাধ্যবাধকতা তৈরি করা যায় না —
// কেউ client bypass করে rate-limit ডকুমেন্ট না ছুঁয়েই মূল write করে
// ফেলতে পারতো। Admin SDK দিয়ে সার্ভারে করাতে এই ফাঁকটা বন্ধ থাকে।
const COOLDOWN_SECONDS = 30;
const DAILY_LIMIT = 15;

const getTodayInDhaka = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = req.body || {};

    // সার্ভার-সাইড validation — client validation বাইপাস করে কেউ সরাসরি এই
    // API কল করলেও যেন junk/malicious data ঢুকতে না পারে।
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 3000) : "";
    const price = Number(body.price);
    const contactNumber = typeof body.contactNumber === "string" ? body.contactNumber.trim().slice(0, 20) : "";
    const location = typeof body.location === "string" ? body.location.trim().slice(0, 100) : "Bangladesh";
    const images = Array.isArray(body.images) ? body.images.filter((u: any) => typeof u === "string").slice(0, 10) : [];
    const category = body.category === "vehicles" ? "vehicles" : "general";
    const subCategory = typeof body.subCategory === "string" ? body.subCategory.slice(0, 50) : "general";
    const type = body.type === "vehicle" ? "vehicle" : "part";
    const sellerName = typeof body.sellerName === "string" ? body.sellerName.trim().slice(0, 100) : "Seller";

    if (!title || title.length === 0) {
      return res.status(400).json({ error: "শিরোনাম আবশ্যক।" });
    }
    if (!Number.isFinite(price) || price < 0 || price > 99999999) {
      return res.status(400).json({ error: "সঠিক মূল্য দিন।" });
    }
    if (images.length === 0) {
      return res.status(400).json({ error: "কমপক্ষে একটি ছবি দরকার।" });
    }

    const db = getFirestore();
    const rateLimitRef = db.collection("rate_limits").doc(uid);
    const listingRef = db.collection("listings").doc();
    const today = getTodayInDhaka();

    const result = await db.runTransaction(async (tx) => {
      const rlSnap = await tx.get(rateLimitRef);
      const rl = rlSnap.exists ? (rlSnap.data() as any) : {};

      const lastAt: Timestamp | undefined = rl.lastListingCreateAt;
      if (lastAt) {
        const elapsedSeconds = (Date.now() - lastAt.toMillis()) / 1000;
        if (elapsedSeconds < COOLDOWN_SECONDS) {
          return { limited: true, reason: "cooldown", retryAfter: Math.ceil(COOLDOWN_SECONDS - elapsedSeconds) };
        }
      }

      const countToday = rl.listingsTodayDate === today ? (rl.listingsTodayCount || 0) : 0;
      if (countToday >= DAILY_LIMIT) {
        return { limited: true, reason: "daily_limit" };
      }

      tx.set(listingRef, {
        title,
        model: title,
        category,
        subCategory,
        partCategory: "other",
        brand: "",
        condition: "used",
        price,
        description,
        location,
        contactNumber,
        images,
        sellerId: uid,
        sellerName,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        type,
      });

      tx.set(rateLimitRef, {
        lastListingCreateAt: FieldValue.serverTimestamp(),
        listingsTodayDate: today,
        listingsTodayCount: countToday + 1,
      }, { merge: true });

      return { limited: false };
    });

    if (result.limited) {
      if (result.reason === "daily_limit") {
        return res.status(429).json({ error: `একদিনে সর্বোচ্চ ${DAILY_LIMIT}টি লিস্টিং পোস্ট করা যায়। আগামীকাল আবার চেষ্টা করুন।` });
      }
      return res.status(429).json({
        error: `একটু অপেক্ষা করুন — এত দ্রুত পরপর লিস্টিং পোস্ট করা যায় না। ${result.retryAfter} সেকেন্ড পর আবার চেষ্টা করুন।`,
        retryAfter: result.retryAfter,
      });
    }

    return res.status(200).json({ id: listingRef.id });
  } catch (err: any) {
    console.error("listing create failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
        }

