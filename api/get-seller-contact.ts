import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// 🔧 Fixes: "seller contact scrape risk" (audit item -- private contact
// leak, High priority).
//
// Before: any signed-in user could read listings/{id}/private/contact
// directly from Firestore, one listing at a time, with NO limit on how
// many listings they read this way. The "Show Number" feature itself is
// legitimate and intentionally open to any signed-in visitor -- so the
// fix is to rate-limit *how many* a single account can reveal, not *who*
// can see a number.
//
// 🔧 (2026-10-XX, Firebase removal) Firebase ID-token fallback and the
// Firestore legacy-listing lookup path are both gone -- phone login is
// 100% Supabase now, and any listing that genuinely never made it into
// the Supabase migration is treated as not-found rather than falling
// back to Firestore. Every active listing lives in Supabase's `listings`
// table, matched by UUID id or legacy_firestore_id (for a listing created
// pre-migration but imported since).
// ------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // reveals per user per hour -- generous for a
// genuine buyer browsing many listings, but stops a scripted account from
// harvesting the whole marketplace's phone numbers in one sweep.

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Firestore-era auto-generated doc IDs are alphanumeric base62-ish strings.
const SAFE_LEGACY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
    }

    const uid = await verifySupabaseToken(idToken);
    if (!uid) {
      return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "listingId প্রয়োজন।" });
    }

    const allowed = await checkAndBumpRateLimit(`contact_reveal_${uid}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার নম্বর দেখার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[get-seller-contact] Missing Supabase env vars -- url:", !!supabaseUrl, "serviceKey:", !!supabaseServiceKey);
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const isUuid = UUID_RE.test(listingId);
    if (!isUuid && !SAFE_LEGACY_ID.test(listingId)) {
      return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fast path: brand-new listings (the vast majority) always have a real
    // UUID id -- one direct query, no legacy-id lookup needed at all.
    if (isUuid) {
      const { data: contactRow, error: contactErr } = await supabase
        .from("listing_contacts")
        .select("phone")
        .eq("listing_id", listingId)
        .maybeSingle();

      if (contactErr) {
        console.error("[get-seller-contact] Supabase fast-path error:", contactErr.message);
        return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
      }
      if (contactRow?.phone) {
        return res.status(200).json({ contactNumber: contactRow.phone });
      }
      return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
    }

    // Legacy id: resolve via legacy_firestore_id to the migrated UUID row.
    const { data: listingRow, error: listingErr } = await supabase
      .from("listings")
      .select("id")
      .eq("legacy_firestore_id", listingId)
      .maybeSingle();

    if (listingErr) {
      console.error("[get-seller-contact] Supabase legacy-fallback error:", listingErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
    }
    if (!listingRow) {
      return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
    }

    const { data: contactRow, error: contactErr } = await supabase
      .from("listing_contacts")
      .select("phone")
      .eq("listing_id", listingRow.id)
      .maybeSingle();
    if (contactErr) {
      console.error("[get-seller-contact] Supabase legacy contact lookup error:", contactErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে।" });
    }
    if (contactRow?.phone) {
      return res.status(200).json({ contactNumber: contactRow.phone });
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
  }
}
