import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }

    // 1. Verify this webhook really came from UddoktaPay
    const headerKey = req.headers["rt-uddoktapay-api-key"];
    if (!headerKey || headerKey !== apiKey) {
      return res.status(401).json({ error: "Unauthorized webhook." });
    }

    const payload = req.body || {};
    const status = payload.status;
    const metadata = payload.metadata || {};
    const requestId = metadata.requestId;
    const chargedAmount = Number(payload.amount || payload.charged_amount || 0);
    const transactionId = payload.transaction_id || "";
    const invoiceId = payload.invoice_id || "";

    if (!requestId) {
      // Nothing we can tie this back to — acknowledge so UddoktaPay stops retrying, but log it.
      console.error("Webhook missing requestId in metadata:", payload);
      return res.status(200).json({ received: true });
    }

    if (status !== "COMPLETED") {
      // Payment failed/pending — nothing to credit, just acknowledge.
      return res.status(200).json({ received: true });
    }

    const db = getFirestore();
    const reqRef = db.collection("refill_requests").doc(requestId);

    // 2. Process idempotently inside a transaction so a duplicate webhook
    //    call can never credit the same payment twice.
    await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) {
        throw new Error(`refill_request ${requestId} not found`);
      }
      const request = reqSnap.data() as any;

      if (request.status !== "pending") {
        // Already processed (e.g. duplicate webhook delivery) — do nothing.
        return;
      }

      // Sanity check: the amount actually paid should match what was requested.
      if (chargedAmount && Math.abs(chargedAmount - Number(request.amount)) > 1) {
        throw new Error(
          `Amount mismatch for ${requestId}: requested ${request.amount}, charged ${chargedAmount}`
        );
      }

      if (request.type === "ad_promotion" && request.listingId) {
        const listingRef = db.collection("listings").doc(request.listingId);
        const duration = Number(request.durationDays || 3);
        tx.update(listingRef, {
          isAd: true,
          adTier: request.adTier || "basic",
          adDurationDays: duration,
          adExpiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        });
      } else {
        const userRef = db.collection("users").doc(request.userId);
        tx.update(userRef, {
          simulatedCredits: FieldValue.increment(Number(request.amount)),
        });
      }

      tx.update(reqRef, {
        status: "approved",
        approvedAt: new Date().toISOString(),
        reviewedBy: "UddoktaPay Webhook",
        transactionId,
        invoiceId,
      });
    });

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("payment webhook failed:", err);
    // Still return 200 for "not found"/duplicate cases so UddoktaPay doesn't retry forever;
    // return 500 only for genuine unexpected failures worth a retry.
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
