import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "crypto";

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

const hashOtp = (otp: string, phone: string) =>
  createHash("sha256").update(`${otp}:${phone}:${process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.slice(0, 16) || "salt"}`).digest("hex");

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

    const { phoneNumber, code, purpose } = req.body || {};
    const cleanPhone = String(phoneNumber || "").replace(/\D/g, "");
    const cleanCode = String(code || "").replace(/\D/g, "");

    if (cleanPhone.length !== 11 || cleanCode.length !== 6) {
      return res.status(400).json({ error: "সঠিক নম্বর ও OTP কোড দিন।" });
    }

    const db = getFirestore();
    const otpRef = db.collection("otp_codes").doc(cleanPhone);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
      return res.status(400).json({ error: "কোনো OTP পাঠানো হয়নি অথবা মেয়াদ শেষ। আবার চেষ্টা করুন।" });
    }

    const otpData = otpSnap.data() as any;

    if (new Date(otpData.expiresAt).getTime() < Date.now()) {
      await otpRef.delete();
      return res.status(400).json({ error: "OTP-র মেয়াদ শেষ হয়ে গেছে। আবার পাঠান।" });
    }

    if ((otpData.attempts || 0) >= 5) {
      await otpRef.delete();
      return res.status(429).json({ error: "অনেকবার ভুল চেষ্টা হয়েছে। আবার OTP চান।" });
    }

    if (hashOtp(cleanCode, cleanPhone) !== otpData.codeHash) {
      await otpRef.update({ attempts: (otpData.attempts || 0) + 1 });
      return res.status(400).json({ error: "ভুল OTP কোড।" });
    }

    // সঠিক কোড — একবার ব্যবহারের পর মুছে ফেলি, একই কোড দুবার কাজ করবে না
    await otpRef.delete();

    // শুধু "login" purpose-এর ক্ষেত্রেই existing account-এর জন্য customToken দরকার।
    // "register" purpose হলে শুধু ownership verified — client নিজের anonymous uid ব্যবহার করে account বানাবে।
    if (purpose === "login") {
      const querySnap = await db.collection("users").where("phoneNumber", "==", cleanPhone).limit(1).get();
      if (querySnap.empty) {
        return res.status(404).json({ error: "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" });
      }
      const existingDoc = querySnap.docs[0];
      const existingUid = existingDoc.id;
      const customToken = await getAuth().createCustomToken(existingUid);
      return res.status(200).json({ verified: true, customToken, existingData: existingDoc.data() });
    }

    return res.status(200).json({ verified: true });
  } catch (err: any) {
    console.error("verify-otp failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।", detail: String(err?.message || err) });
  }
}
