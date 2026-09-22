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

// Audit B11: "not found" and "amount mismatch" are permanent failures --
// retrying the exact same webhook payload will NEVER succeed, so returning
// 500 for these just makes UddoktaPay hammer this endpoint forever. Tag
// them so the catch block below can 200 (acknowledge + stop retries) while
// still returning 500 for genuinely transient errors (e.g. Firestore
// hiccups) that a retry might actually fix.
class PermanentWebhookError extends Error {}

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
        throw new PermanentWebhookError(`refill_request ${requestId} not found`);
      }
      const request = reqSnap.data() as any;

      if (request.status !== "pending") {
        // Already processed (e.g. duplicate webhook delivery) — do nothing.
        return;
      }

      // Replay protection: the same real transaction_id must never be able
      // to approve a SECOND refill_requests doc. Idempotency above already
      // stops the exact same requestId from double-crediting, but that
      // alone doesn't stop a captured/replayed webhook payload from having
      // its metadata.requestId swapped to point at a different still-pending
      // request while keeping the original (already-used) transaction_id.
      if (transactionId) {
        const reusedTxnQuery = db
          .collection("refill_requests")
          .where("transactionId", "==", transactionId)
          .where("status", "==", "approved")
          .limit(1);
        const reusedTxnSnap = await tx.get(reusedTxnQuery);
        if (!reusedTxnSnap.empty) {
          throw new PermanentWebhookError(
            `transaction_id ${transactionId} already used to approve a different refill_request`
          );
        }
      }

      // Sanity check: a missing/zero charged amount is rejected outright
      // (not silently skipped) - and if a real amount is present, it must
      // match what was requested.
      if (!chargedAmount || chargedAmount <= 0) {
        throw new PermanentWebhookError(
          `Missing or zero charged amount for ${requestId}: ${chargedAmount}`
        );
      }
      if (Math.abs(chargedAmount - Number(request.amount)) > 1) {
        throw new PermanentWebhookError(
          `Amount mismatch for ${requestId}: requested ${request.amount}, charged ${chargedAmount}`
        );
      }

      if (request.type === "ad_promotion" && request.listingId) {
        // Defense-in-depth: firestore.rules already requires the payer to be
        // the listing's sellerId at refill_request creation time, but that
        // doesn't protect against the listing's ownership having changed
        // since, or against a refill_request created by some other path
        // (e.g. directly via the Admin SDK) that skipped the rule entirely.
        // The webhook is the last line of defense before a listing is
        // actually marked isAd:true, so it re-checks ownership itself
        // rather than trusting the request doc blindly.
        const listingRef = db.collection("listings").doc(request.listingId);
        const listingSnap = await tx.get(listingRef);
        if (!listingSnap.exists) {
          throw new PermanentWebhookError(`ad_promotion target listing ${request.listingId} not found`);
        }
        if (listingSnap.data()?.sellerId !== request.userId) {
          throw new PermanentWebhookError(
            `ad_promotion requester ${request.userId} does not own listing ${request.listingId}`
          );
        }

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
    if (err instanceof PermanentWebhookError) {
      // Already logged above for manual follow-up (e.g. check the
      // UddoktaPay dashboard for this transaction) -- retrying won't fix a
      // request that doesn't exist or an amount that will always mismatch,
      // so acknowledge to stop the retry loop instead of returning 500.
      return res.status(200).json({ received: true });
    }
    // Genuine transient failure (Firestore hiccup, etc.) — ask UddoktaPay to retry.
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
