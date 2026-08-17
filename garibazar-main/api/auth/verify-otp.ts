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

const MAX_ATTEMPTS = 5;

function normalizeBanglaPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

function hashOtp(code: string, phone: string): string {
  const pepper = process.env.OTP_HASH_PEPPER || "garibazar-otp";
  return crypto.createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
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
    const code = String(req.body?.code || "").trim();

    if (!phone || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "সঠিক মোবাইল নম্বর ও ৬-সংখ্যার কোড দিন।" });
    }

    const db = getFirestore();
    const otpRef = db.collection("otp_codes").doc(phone);

    const verifiedPhone = await db.runTransaction(async (tx) => {
      const snap = await tx.get(otpRef);
      if (!snap.exists) {
        throw new Error("NOT_FOUND");
      }
      const data = snap.data() as any;

      if (Date.now() > data.expiresAt) {
        tx.delete(otpRef);
        throw new Error("EXPIRED");
      }
      if ((data.attempts || 0) >= MAX_ATTEMPTS) {
        tx.delete(otpRef);
        throw new Error("TOO_MANY_ATTEMPTS");
      }

      const expectedHash = hashOtp(code, phone);
      if (expectedHash !== data.otpHash) {
        tx.update(otpRef, { attempts: (data.attempts || 0) + 1 });
        throw new Error("WRONG_CODE");
      }

      tx.delete(otpRef);
      return phone;
    });

    const adminAuth = getAuth();
    let uid: string;
    try {
      const existing = await adminAuth.getUserByPhoneNumber(verifiedPhone);
      uid = existing.uid;
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") {
        const created = await adminAuth.createUser({ phoneNumber: verifiedPhone });
        uid = created.uid;
      } else {
        throw e;
      }
    }

    const customToken = await adminAuth.createCustomToken(uid);
    return res.status(200).json({ token: customToken, uid, phone: verifiedPhone });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg === "NOT_FOUND" || msg === "EXPIRED") {
      return res.status(400).json({ error: "কোডের মেয়াদ শেষ। নতুন কোড চান।" });
    }
    if (msg === "TOO_MANY_ATTEMPTS") {
      return res.status(429).json({ error: "অনেকবার ভুল হয়েছে। নতুন কোড চান।" });
    }
    if (msg === "WRONG_CODE") {
      return res.status(400).json({ error: "ভুল কোড। আবার চেষ্টা করুন।" });
    }
    console.error("verify-otp failed:", err);
    return res.status(500).json({ error: "ভেরিফিকেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" });
  }
    }
