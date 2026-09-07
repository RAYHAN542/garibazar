import { createClient } from "@supabase/supabase-js";

class PermanentWebhookError extends Error {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }

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

    const { data: request, error: reqErr } = await supabaseAdmin
      .from("refill_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !request) {
      throw new PermanentWebhookError(`refill_request ${requestId} not found`);
    }

    if (request.status !== "pending") {
      return res.status(200).json({ received: true });
    }

    if (transactionId) {
      const { data: reused } = await supabaseAdmin
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

    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("refill_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        transaction_id: transactionId,
        invoice_id: invoiceId,
      })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (claimErr || !claimed) {
      return res.status(200).json({ received: true });
    }

    if (claimed.type === "ad_promotion" && claimed.listing_id) {
      const { data: listingRow } = await supabaseAdmin
        .from("listings")
        .select("seller_id")
        .eq("id", claimed.listing_id)
        .maybeSingle();
      if (!listingRow) {
        throw new PermanentWebhookError(`ad_promotion target listing ${claimed.listing_id} not found`);
      }
      if (listingRow.seller_id !== claimed.user_id) {
        throw new PermanentWebhookError(
          `ad_promotion requester ${claimed.user_id} does not own listing ${claimed.listing_id}`
        );
      }
      const duration = Number(claimed.duration_days || 3);
      await supabaseAdmin
        .from("listings")
        .update({
          is_ad: true,
          ad_tier: claimed.ad_tier || "basic",
          ad_duration_days: duration,
          ad_expires_at: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", claimed.listing_id);
    } else {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("simulated_credits")
        .eq("uid", claimed.user_id)
        .maybeSingle();
      const currentCredits = Number(userRow?.simulated_credits || 0);
      await supabaseAdmin
        .from("users")
        .update({ simulated_credits: currentCredits + Number(claimed.amount) })
        .eq("uid", claimed.user_id);
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
