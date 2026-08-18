import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

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

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

    if (!phone || !password) {
      return res.status(400).json({ error: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });
    }

    const db = getFirestore();
    const authRef = db.collection("phone_auth").doc(phone);
    const snap = await authRef.get();

    if (!snap.exists) {
      return res.status(404).json({
        error: "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করুন।",
        code: "NOT_REGISTERED",
      });
    }

    const data = snap.data() as any;
    const now = Date.now();

    if (data.lockUntil && now < data.lockUntil) {
      const waitMin = Math.ceil((data.lockUntil - now) / 60000);
      return res.status(429).json({
        error: `অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${waitMin} মিনিট পর আবার চেষ্টা করুন।`,
      });
    }

    const computedHash = hashPassword(password, data.salt);
    const stored = Buffer.from(data.passwordHash, "hex");
    const computed = Buffer.from(computedHash, "hex");
    const matches = stored.length === computed.length && crypto.timingSafeEqual(stored, computed);

    if (!matches) {
      const failedAttempts = (data.failedAttempts || 0) + 1;
      const update: any = { failedAttempts };
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        update.lockUntil = now + LOCK_DURATION_MS;
        update.failedAttempts = 0;
      }
      await authRef.update(update);
      return res.status(400).json({ error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" });
    }

    if (data.failedAttempts || data.lockUntil) {
      await authRef.update({ failedAttempts: 0, lockUntil: 0 });
    }

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
    console.error("phone-login failed:", err);
    return res.status(500).json({ error: "লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" });
  }
}
