import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const SITE_URL = "https://garibazar.shop";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const baseUrl = process.env.UDDOKTAPAY_BASE_URL;
    if (!apiKey || !baseUrl) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }

    // 1. Verify the caller is a signed-in user
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // 2. Load the pending refill_request the user already created client-side
    const { requestId } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ error: "requestId প্রয়োজন।" });
    }

    const db = getFirestore();
    const reqRef = db.collection("refill_requests").doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      return res.status(404).json({ error: "রিকোয়েস্ট খুঁজে পাওয়া যায়নি।" });
    }
    const request = reqSnap.data() as any;

    if (request.userId !== uid) {
      return res.status(403).json({ error: "এই রিকোয়েস্ট আপনার নয়।" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "এই রিকোয়েস্টটি ইতিমধ্যে প্রসেস হয়ে গেছে।" });
    }
    const amount = Number(request.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "সঠিক পরিমাণ নেই।" });
    }

    // 3. Look up the user's profile for name/phone (used as billing info)
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};
    const displayName = userData.displayName || "Gari Bazar User";
    const phoneNumber = userData.phoneNumber || "";
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
