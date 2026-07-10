import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { sendSms, generateOtp } from "../utils/sms";

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

    // caller must at least be signed in anonymously — stops random bots hitting this for free
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    await getAuth().verifyIdToken(idToken);

    const { phoneNumber } = req.body || {};
    const cleanPhone = String(phoneNumber || "").replace(/\D/g, "");
    if (cleanPhone.length !== 11) {
      return res.status(400).json({ error: "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।" });
    }

    const db = getFirestore();
    const otpRef = db.collection("otp_codes").doc(cleanPhone);
    const existing = await otpRef.get();

    // Rate limit: একই নম্বরে ৬০ সেকেন্ডে একবারের বেশি OTP পাঠানো যাবে না
    if (existing.exists) {
      const data = existing.data() as any;
      const lastSentAt = new Date(data.createdAt).getTime();
      if (Date.now() - lastSentAt < 60_000) {
        return res.status(429).json({ error: "একটু পরে আবার চেষ্টা করুন (৬০ সেকেন্ড অপেক্ষা করুন)।" });
      }
    }

    const otp = generateOtp();
    await otpRef.set({
      codeHash: hashOtp(otp, cleanPhone),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempts: 0,
    });

    await sendSms(cleanPhone, `আপনার Gari Bazar OTP কোড: ${otp} (৫ মিনিটের জন্য বৈধ)`);

    return res.status(200).json({ sent: true });
  } catch (err: any) {
    console.error("send-otp failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।", detail: String(err?.message || err) });
  }
}
