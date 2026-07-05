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
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }

    await getAuth().verifyIdToken(idToken);

    const { phoneNumber } = req.body || {};
    const cleanPhone = String(phoneNumber || "").replace(/\D/g, "");

    if (cleanPhone.length !== 11) {
      return res.status(400).json({ error: "সঠিক ফোন নম্বর দিন।" });
    }

    const db = getFirestore();
    const querySnap = await db.collection("users").where("phoneNumber", "==", cleanPhone).limit(1).get();

    if (querySnap.empty) {
      return res.status(404).json({ error: "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" });
    }

    const existingUid = querySnap.docs[0].id;
    const customToken = await getAuth().createCustomToken(existingUid);

    return res.status(200).json({ customToken });
  } catch (err: any) {
    console.error("link-account failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।", detail: String(err && err.message || err) });
  }
}
