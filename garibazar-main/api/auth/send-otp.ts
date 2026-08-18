import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_PER_DAY = 5;

// Normalizes any of: 01XXXXXXXXX, +8801XXXXXXXXX, 8801XXXXXXXXX -> +8801XXXXXXXXX
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

async function sendSms(phone: string, text: string): Promise<void> {
  const user = process.env.SMS_GATEWAY_USERNAME;
  const pass = process.env.SMS_GATEWAY_PASSWORD;
  if (!user || !pass) {
    throw new Error("SMS gateway credentials not configured");
  }
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const resp = await fetch("https://api.sms-gate.app/3rdparty/v1/messages", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textMessage: { text },
      phoneNumbers: [phone],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`SMS gateway responded ${resp.status}: ${body}`);
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

    const phone = normalizeBanglaPhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ error: "সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।" });
    }

    const db = getFirestore();
    const otpRef = db.collection("otp_codes").doc(phone);
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);

    const code = crypto.randomInt(100000, 1000000).toString();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(otpRef);
      const data = snap.exists ? (snap.data() as any) : null;

      if (data?.lastSentAt && now - data.lastSentAt < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - data.lastSentAt)) / 1000);
        throw new Error(`COOLDOWN:${waitSec}`);
      }

      const sameDay = data?.dayKey === todayKey;
      const countToday = sameDay ? (data?.sentCountToday || 0) : 0;
      if (countToday >= MAX_PER_DAY) {
        throw new Error("DAILY_LIMIT");
      }

      tx.set(otpRef, {
        phone,
        otpHash: hashOtp(code, phone),
        expiresAt: now + OTP_TTL_MS,
        attempts: 0,
        lastSentAt: now,
        dayKey: todayKey,
        sentCountToday: countToday + 1,
      });
    });

    await sendSms(phone, `আপনার Garibazar OTP কোড: ${code}। ৫ মিনিটের মধ্যে ব্যবহার করুন। কাউকে শেয়ার করবেন না।`);

    return res.status(200).json({ success: true });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.startsWith("COOLDOWN:")) {
      const waitSec = msg.split(":")[1];
      return res.status(429).json({ error: `একটু অপেক্ষা করুন, আবার কোড পাঠাতে ${waitSec} সেকেন্ড বাকি।` });
    }
    if (msg === "DAILY_LIMIT") {
      return res.status(429).json({ error: "আজকের জন্য OTP পাঠানোর সর্বোচ্চ সীমা শেষ। আগামীকাল আবার চেষ্টা করুন।" });
    }
    console.error("send-otp failed:", err);
    return res.status(500).json({ error: "OTP পাঠাতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" });
  }
    }
