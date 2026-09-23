import { createClient } from "@supabase/supabase-js";

// 🔧 (2026-09-23) এই ওয়েবহুক আগে সম্পূর্ণ Firestore-নির্ভর ছিল --
// refill_requests, listings, users সবকিছু Firestore-এ read/write হতো।
// migration-এর পর এই টেবিলগুলো Supabase-এ থাকে (client-side create এখন
// Supabase-এ হয়, দেখুন useAdPromotion.ts/PromoteAdModal.tsx), তাই এই
// ওয়েবহুক কখনো আসল refill_request খুঁজেই পেত না -- payment confirm হলেও
// বিজ্ঞাপন কখনো লাইভ হতো না। এখন পুরো ফ্লো Supabase-এ।
//
// Firestore-এর transaction()-এর মতো নেই বলে atomicity এভাবে করা হয়েছে:
// প্রথমে সব validation (owner check, amount match, replay protection) একটা
// read দিয়ে করা হয়, তারপর status='pending' শর্তসহ একটা conditional UPDATE
// দিয়ে request-টা "claim" করা হয় -- দুইটা webhook call একসাথে এলেও শুধু
// একটাই claim সফল হবে (রেসের ঝুঁকি ন্যূনতম, একই payment provider থেকে
// duplicate delivery ঠেকানোই মূল উদ্দেশ্য)।
class PermanentWebhookError extends Error {}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.error("Webhook missing requestId in metadata:", payload);
      return res.status(200).json({ received: true });
    }

    if (status !== "COMPLETED") {
      return res.status(200).json({ received: true });
    }

    // 2. Load + validate before claiming
    const { data: request, error: fetchErr } = await supabase
      .from("refill_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchErr) {
      // Transient DB error — ask UddoktaPay to retry.
      throw new Error(`refill_requests lookup failed: ${fetchErr.message}`);
    }
    if (!request) {
      throw new PermanentWebhookError(`refill_request ${requestId} not found`);
    }
    if (request.status !== "pending") {
      // Already processed (e.g. duplicate webhook delivery) — do nothing.
      return res.status(200).json({ received: true });
    }

    // Replay protection: the same real transaction_id must never be able
    // to approve a SECOND refill_requests row.
    if (transactionId) {
      const { data: reused } = await supabase
        .from("refill_requests")
        .select("id")
        .eq("transaction_id", transactionId)
        .eq("status", "approved")
        .limit(1);
      if (reused && reused.length > 0) {
        throw new PermanentWebhookError(
          `transaction_id ${transactionId} already used to approve a different refill_request`
        );
      }
    }

    if (!chargedAmount || chargedAmount <= 0) {
      throw new PermanentWebhookError(`Missing or zero charged amount for ${requestId}: ${chargedAmount}`);
    }
    if (Math.abs(chargedAmount - Number(request.amount)) > 1) {
      throw new PermanentWebhookError(
        `Amount mismatch for ${requestId}: requested ${request.amount}, charged ${chargedAmount}`
      );
    }

    if (request.type === "ad_promotion" && request.listing_id) {
      // Defense-in-depth: re-check ownership at approval time too, not just
      // at request-creation time (listing ownership could have changed since).
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .select("seller_id")
        .eq("id", request.listing_id)
        .maybeSingle();
      if (listingErr) throw new Error(`listing lookup failed: ${listingErr.message}`);
      if (!listingRow) {
        throw new PermanentWebhookError(`ad_promotion target listing ${request.listing_id} not found`);
      }
      if (listingRow.seller_id !== request.user_id) {
        throw new PermanentWebhookError(
          `ad_promotion requester ${request.user_id} does not own listing ${request.listing_id}`
        );
      }
    }

    // 3. Claim the request atomically (only succeeds if still "pending")
    const { data: claimed, error: claimErr } = await supabase
      .from("refill_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        transaction_id: transactionId,
        invoice_id: invoiceId,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimErr) throw new Error(`refill_requests claim failed: ${claimErr.message}`);
    if (!claimed) {
      // Lost the race to a concurrent webhook delivery — already handled.
      return res.status(200).json({ received: true });
    }

    // 4. Apply the actual effect now that the request is safely claimed.
    if (request.type === "ad_promotion" && request.listing_id) {
      const duration = Number(request.duration_days || 3);
      const { error: updateErr } = await supabase
        .from("listings")
        .update({
          is_ad: true,
          ad_tier: request.ad_tier || "basic",
          ad_duration_days: duration,
          ad_expires_at: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", request.listing_id);
      if (updateErr) console.error("payment webhook: failed to activate ad:", updateErr.message);
    } else {
      // Atomic increment via a Postgres expression, not a read-then-write --
      // avoids losing a concurrent top-up.
      const { error: creditErr } = await supabase.rpc("increment_simulated_credits", {
        p_uid: request.user_id,
        p_amount: Number(request.amount),
      });
      if (creditErr) console.error("payment webhook: failed to credit wallet:", creditErr.message);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("payment webhook failed:", err);
    if (err instanceof PermanentWebhookError) {
      return res.status(200).json({ received: true });
    }
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
