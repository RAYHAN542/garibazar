import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit, getClientIp } from "./_lib/rateLimit.js";

// ------------------------------------------------------------------------
// 🔧 Fixes: "Guest support ticket unlimited creation; guest spam is easy"
// (audit item, Medium priority).
//
// Before: the client called addDoc() straight to Firestore for BOTH guests
// and signed-in users, with a rule that only checked the shape of the
// document (userId matches auth state) -- nothing capped HOW MANY tickets
// either could file. A guest has no auth.uid at all, so Firestore rules
// have no stable per-guest identity to even attempt a rate limit against.
//
// Now: guests and signed-in users both submit through this endpoint, which
// enforces a rate limit server-side --
//   - Guests: limited per IP address (the only identity a guest has).
//   - Signed-in users: limited per uid (more generous, since a real
//     account is harder to mass-create than an anonymous request).
// firestore.rules' support_tickets collection is locked to admin-only
// writes now, so a client bypassing this endpoint and writing directly to
// Firestore is rejected outright.
// ------------------------------------------------------------------------

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

const GUEST_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GUEST_MAX = 3; // per IP -- a real visitor rarely files more than one
// or two tickets in an hour; a script hammering the form does not get far.

const USER_WINDOW_MS = 60 * 60 * 1000;
const USER_MAX = 10; // per signed-in uid -- more generous than a guest,
// since creating many real accounts is a much higher bar than just
// resending an anonymous request.

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const { name, email, message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "বার্তা লিখুন।" });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "বার্তা অনেক বড়।" });
    }

    // Signed-in users identify themselves with their ID token (optional
    // header); anyone without one is treated as a guest and rate-limited
    // by IP instead.
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    let uid: string | null = null;
    if (idToken) {
      try {
        const decoded = await getAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch {
        // Invalid/expired token -- fall back to treating this as a guest
        // rather than hard-failing the whole request.
        uid = null;
      }
    }

    const allowed = uid
      ? await checkAndBumpRateLimit(`support_${uid}`, USER_WINDOW_MS, USER_MAX)
      : await checkAndBumpRateLimit(`support_ip_${getClientIp(req)}`, GUEST_WINDOW_MS, GUEST_MAX);

    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার সাপোর্ট টিকেট পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    const db = getFirestore();
    await db.collection("support_tickets").add({
      name: (name || "").toString().slice(0, 200) || (uid ? "User" : "Anonymous"),
      email: (email || "").toString().slice(0, 200) || "anonymous@garibazar.com",
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
      userId: uid || "guest",
      status: "open",
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[submit-support-ticket] error:", err?.message || err);
    return res.status(500).json({ error: "টিকেট জমা দেওয়া যায়নি। আবার চেষ্টা করুন।" });
  }
}
