import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Shared rate limiter, backed by a Firestore transaction instead of an
// in-memory Map.
//
// Why: a `new Map()` at module scope only persists for the lifetime of ONE
// warm serverless instance. Vercel can and does spin up several concurrent
// instances for the same function under load (every cold start gets its own
// empty Map) -- so an in-memory "10 requests/minute per IP" limit is really
// "10 requests/minute PER INSTANCE", and a script sending requests fast
// enough to trigger concurrent cold starts sails past it entirely. This was
// the case for phone-signup.ts and phone-login.ts (account-creation /
// brute-force surfaces -- exactly where a bypassable limit matters most)
// before this fix; get-seller-contact.ts and submit-support-ticket.ts
// already used this Firestore-transaction pattern inline, so this just
// factors that same durable pattern out into one shared place both old and
// new callers use, instead of four separate copies of the same logic.
// ---------------------------------------------------------------------------
export async function checkAndBumpRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection("rate_limits").doc(key);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    if (!snap.exists) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    const data = snap.data() as { count: number; windowStart: number };
    if (now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= max) return false;
    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
}

export function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}
