import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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
//
// 🔧 SECOND FIX (2026-09-23): this endpoint only ever verified a Firebase
// ID token. Login moved to Supabase months ago, so the frontend has been
// sending a Supabase access token here -- getAuth().verifyIdToken() always
// threw on that (wrong signer entirely), so EVERY "Show number" click by a
// regular signed-in buyer failed and rendered "—". Owners/admins didn't
// notice because that path fetches the number a different way (direct
// Supabase RPC from the client, see ListingDetailModal.tsx). Now this
// tries the current Supabase token first, and only falls back to the old
// Firebase check for any still-cached legacy sessions.
//
// 🔧 THIRD FIX (2026-09-25) "Show number takes ~5 seconds": every single
// request -- even for a brand-new listing -- was doing THREE sequential
// network round-trips: (1) a Firestore lookup that could never succeed for
// a post-migration listing, (2) a Supabase `listings` existence check, (3)
// a separate Supabase `listing_contacts` lookup. New listings always get a
// real UUID as their id (see AddPartForm.tsx's Supabase insert) and were
// NEVER a Firestore document, so for a UUID id we now skip straight to a
// single `listing_contacts` query. The slower legacy path (Firestore, then
// a `legacy_firestore_id` lookup) still runs, but only for old
// non-UUID ids -- a shrinking minority of listings.
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

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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

    // Try the current login system (Supabase) first.
    let uid: string | null = await verifySupabaseToken(idToken);

    // Fall back to a legacy Firebase ID token, if any cached session still
    // sends one and Firebase Admin is configured.
    if (!uid) {
      if (!getApps().length) {
        return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
      }
      try {
        const decoded = await getAuth().verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (e) {
        return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
      }
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
    }

    // Fast path: brand-new listings (the vast majority now) always have a
    // real UUID id and were never a Firestore document -- one direct query,
    // no Firestore round-trip, no extra "does this listing exist" check.
    if (UUID_RE.test(listingId) && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

    // Legacy path: a non-UUID id can only be an old Firestore document ID.
    if (getApps().length) {
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
    }

    // Not in Firestore either -- check whether it was migrated into
    // Supabase under a new UUID with this as its legacy_firestore_id.
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: listingRow, error: listingErr } = await supabase
        .from("listings")
        .select("id")
        .eq("legacy_firestore_id", listingId)
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
        console.error("[get-seller-contact] Supabase legacy-fallback error:", listingErr.message);
      }
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
  }
}
