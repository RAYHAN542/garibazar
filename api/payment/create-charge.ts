import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { applyCors } from "../_lib/cors.js";

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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function resolveCallerUid(token: string): Promise<string | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return data.user.id;
    } catch (e) {
      console.error("[create-charge] supabase token check failed:", e);
    }
  }
  if (getApps().length) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.uid;
    } catch (e) {
      console.error("[create-charge] firebase token check failed:", (e as any)?.message || e);
    }
  }
  return null;
}

// 🔧 FIX: same root cause as api/delete-account.ts and api/draw.ts -- a
// migrated ("restore old account") user's real app-wide uid
// (refill_requests.user_id, listings.seller_id, users.uid) is their OLD
// legacy id, not the fresh Supabase Auth id their current login session
// carries. Without this, every ownership check below (`request.user_id !==
// uid`, `listingRow.seller_id !== uid`) compared the real owner id against
// the wrong id and always failed -- so migrated sellers could never
// actually pay for a wallet refill or ad promotion; every attempt returned
// "এই রিকোয়েস্ট/লিস্টিং আপনার নয়" (not yours). It also fed the wrong uid
// into the payment's metadata, which is what the webhook later uses to
// credit the right account.
async function resolveAppUid(authUid: string): Promise<string> {
  if (!supabaseAdmin) return authUid;
  try {
    const { data, error } = await supabaseAdmin
      .from("user_auth_links")
      .select("app_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();
    if (error) throw error;
    return data?.app_uid || authUid;
  } catch (e) {
    console.error("[create-charge] app uid resolution failed, using auth uid:", e);
    return authUid;
  }
}

const SITE_URL = "https://garibazar.shop";

const AD_PACKAGE_PRICES: Record<string, { durationDays: number; price: number }> = {
  basic: { durationDays: 2, price: 100 },
  premium: { durationDays: 4, price: 200 },
  featured: { durationDays: 7, price: 300 },
};

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const apiKey = process.env.UDDOKTAPAY_API_KEY;
    const baseUrl = process.env.UDDOKTAPAY_BASE_URL;
    if (!apiKey || !baseUrl) {
      return res.status(500).json({ error: "পেমেন্ট গেটওয়ে কনফিগার করা নেই।" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
    if (!token) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const authUid = await resolveCallerUid(token);
    if (!authUid) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ।" });
    }
    const uid = await resolveAppUid(authUid);

    const { requestId } = req.body || {};
    if (!requestId) {
      return res.status(400).json({ error: "requestId প্রয়োজন।" });
    }

    const { data: request, error: reqErr } = await supabaseAdmin
      .from("refill_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !request) {
      return res.status(404).json({ error: "রিকোয়েস্ট খুঁজে পাওয়া যায়নি।" });
    }
    if (request.user_id !== uid) {
      return res.status(403).json({ error: "এই রিকোয়েস্ট আপনার নয়।" });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ error: "এই রিকোয়েস্টটি ইতিমধ্যে প্রসেস হয়ে গেছে।" });
    }
    const amount = Number(request.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "সঠিক পরিমাণ নেই।" });
    }

    if (request.type === "ad_promotion") {
      const canonical = AD_PACKAGE_PRICES[request.ad_tier];
      if (!canonical || canonical.durationDays !== Number(request.duration_days) || canonical.price !== amount) {
        console.error("create-charge: ad_promotion price/duration mismatch", {
          requestId, adTier: request.ad_tier, durationDays: request.duration_days, amount,
        });
        return res.status(400).json({ error: "প্যাকেজের তথ্য মেলেনি। অনুগ্রহ করে আবার চেষ্টা করুন।" });
      }

      if (!request.listing_id) {
        return res.status(400).json({ error: "কোন লিস্টিং প্রোমোট করতে চান তা পাওয়া যায়নি।" });
      }
      const { data: listingRow, error: listingErr } = await supabaseAdmin
        .from("listings")
        .select("seller_id")
        .eq("id", request.listing_id)
        .maybeSingle();
      if (listingErr || !listingRow) {
        return res.status(404).json({ error: "লিস্টিংটি খুঁজে পাওয়া যায়নি।" });
      }
      if (listingRow.seller_id !== uid) {
        console.error("create-charge: ad_promotion ownership mismatch", {
          requestId, listingId: request.listing_id, uid,
        });
        return res.status(403).json({ error: "এই লিস্টিং আপনার নয়।" });
      }
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("name, phone")
      .eq("uid", uid)
      .maybeSingle();
    const displayName = userRow?.name || "Gari Bazar User";
    const phoneNumber = userRow?.phone || "";
    const syntheticEmail = `${phoneNumber || uid}@garibazar.app`;

    const checkoutUrl = new URL("api/checkout-v2", baseUrl).toString();
    const uddoktaRes = await fetch(checkoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": apiKey,
      },
      body: JSON.stringify({
        full_name: displayName,
        email: syntheticEmail,
        amount: String(amount),
        currency: "BDT",
        metadata: {
          requestId,
          uid,
        },
        redirect_url: `${SITE_URL}/?payment=success`,
        cancel_url: `${SITE_URL}/?payment=cancel`,
        webhook_url: `${SITE_URL}/api/payment/webhook`,
        return_type: "GET",
      }),
    });

    const uddoktaData = await uddoktaRes.json().catch(() => ({}));

    if (!uddoktaRes.ok || !uddoktaData?.payment_url) {
      console.error("UddoktaPay create-charge failed:", uddoktaData);
      return res.status(502).json({ error: "পেমেন্ট গেটওয়ে থেকে সাড়া পাওয়া যায়নি।" });
    }

    return res.status(200).json({ payment_url: uddoktaData.payment_url });
  } catch (err: any) {
    console.error("create-charge failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
  }
}
