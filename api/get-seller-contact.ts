import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// 🔧 Fixes: "seller contact scrape risk" (audit item -- private contact
// leak, High priority).
//
// Before: any signed-in user could read listings/{id}/private/contact
// directly from Firestore, one listing at a time, with NO limit on how
// many listings they read this way. A logged-in script could enumerate
// every public listing ID and pull every seller's phone number in bulk --
// slower than a true bulk-read, but fully automatable and unbounded.
//
// The "Show Number" feature itself is legitimate and intentionally open to
// any signed-in visitor (this is a normal marketplace pattern, not a bug
// on its own) -- so the fix is NOT to restrict *who* can see a number
// (that would break real buyers who haven't started a chat yet), it's to
// rate-limit *how many* a single account can reveal, the same pattern
// already used for Cloudinary uploads and listing/message cooldowns.
//
// This endpoint is the only sanctioned way to read a seller's contact
// number now. firestore.rules' listings/{id}/private/{docId} read rule is
// locked down to owner+admin only (see the rule comment), so a client
// trying to bypass this endpoint and read Firestore directly gets denied.
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

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // reveals per user per hour -- generous for a
// genuine buyer browsing many listings, but stops a scripted account from
// harvesting the whole marketplace's phone numbers in one sweep.

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!getApps().length) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
    }
    const decoded = await getAuth().verifyIdToken(idToken); // throws if invalid/expired

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "listingId প্রয়োজন।" });
    }

    const allowed = await checkAndBumpRateLimit(`contact_reveal_${decoded.uid}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার নম্বর দেখার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    const db = getFirestore();
    const contactSnap = await db
      .collection("listings")
      .doc(listingId)
      .collection("private")
      .doc("contact")
      .get();

    if (contactSnap.exists && contactSnap.data()?.contactNumber) {
      return res.status(200).json({ contactNumber: contactSnap.data()?.contactNumber });
    }

    // Not in Firestore - this listing was created after the Supabase
    // migration, so its number only lives there now. Uses the service role
    // key (server-side only, never exposed to the client) with a direct
    // query rather than the get_listing_contact_number RPC - that RPC's
    // own "must be signed in" check reads the caller's Supabase session
    // JWT, which doesn't exist when called with a plain service-role
    // client. This endpoint already did its own Firebase-token auth +
    // rate limit above, so re-checking via RLS here would be redundant.
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      // 🔧 আগে এই দুটো env var এর একটা মিসিং থাকলে silently পুরো Supabase
      // fallback অংশটা skip হয়ে যেত -- ফলে শুধু Firestore-এ থাকা পুরনো
      // listing-এর নম্বর দেখাত, নতুন (শুধু Supabase-এ থাকা) listing-এর
      // জন্য সবসময় "পাওয়া যায়নি" দেখাত, কোনো log ছাড়াই। এখন স্পষ্ট করে
      // লগ হবে যাতে ভবিষ্যতে দ্রুত ধরা পড়ে।
      console.error("[get-seller-contact] Missing Supabase env vars -- url:", !!supabaseUrl, "serviceKey:", !!supabaseServiceKey);
    }
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(listingId);
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .select("id")
        .or(isUuid ? `legacy_firestore_id.eq.${listingId},id.eq.${listingId}` : `legacy_firestore_id.eq.${listingId}`)
        .maybeSingle();

      if (!listingErr && listingRow) {
        const { data: contactRow, error: contactErr } = await supabase
          .from("listing_contacts")
          .select("phone")
          .eq("listing_id", listingRow.id)
          .maybeSingle();
        if (!contactErr && contactRow?.phone) {
          return res.status(200).json({ contactNumber: contactRow.phone });
        }
      } else if (listingErr) {
        console.error("[get-seller-contact] Supabase fallback error:", listingErr.message);
      }
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
  }
}
