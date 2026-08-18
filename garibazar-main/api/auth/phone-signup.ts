import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

// SMS-gateway (OTP) নির্ভরতা বাদ দিয়ে ফোন নম্বর + পাসওয়ার্ড দিয়ে সরাসরি
// অ্যাকাউন্ট তৈরি। একই ফোন নম্বর দিয়ে আগে OTP-ভিত্তিক অ্যাকাউন্ট খোলা থাকলে
// (verify-otp.ts একই getUserByPhoneNumber প্যাটার্ন ব্যবহার করে) সেই একই
// Firebase Auth ইউজারের সাথেই এখন পাসওয়ার্ড যুক্ত হবে -- নতুন করে ডুপ্লিকেট
// অ্যাকাউন্ট তৈরি হবে না।

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

function normalizeBanglaPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const phone = normalizeBanglaPhone(req.body?.phone);
    const password = String(req.body?.password || "");

    if (!phone) {
      return res.status(400).json({ error: "সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।" });
    }

    const db = getFirestore();
    const authRef = db.collection("phone_auth").doc(phone);
    const existingSnap = await authRef.get();

    if (existingSnap.exists) {
      return res.status(409).json({
        error: "এই নম্বরে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।",
        code: "ALREADY_REGISTERED",
      });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);

    await authRef.set({
      phone,
      passwordHash,
      salt,
      createdAt: Date.now(),
      failedAttempts: 0,
      lockUntil: 0,
    });

    const adminAuth = getAuth();
    let uid: string;
    try {
      const existing = await adminAuth.getUserByPhoneNumber(phone);
      uid = existing.uid;
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") {
        const created = await adminAuth.createUser({ phoneNumber: phone });
        uid = created.uid;
      } else {
        throw e;
      }
    }

    const customToken = await adminAuth.createCustomToken(uid);
    return res.status(200).json({ token: customToken, uid, phone });
  } catch (err: any) {
    console.error("phone-signup failed:", err);
    return res.status(500).json({ error: "অ্যাকাউন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।" });
  }
}
