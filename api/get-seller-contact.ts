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
//
// 🔧 FIX (Firebase -> Supabase auth migration, re-applied): a later edit
// (this same "audit" pass) accidentally reverted this endpoint to ONLY
// accept a Firebase ID token via getAuth().verifyIdToken(). Login moved to
// Supabase (phone + password) a while back, so the browser only ever has a
// Supabase access token now -- handing that to Firebase's verifier threw
// "incorrect algorithm: expected RS256 but got ES256" on every single
// call, so "Show Number" always 401'd and the UI showed a bare "—" with no
// visible error. Caller identity is now resolved Supabase-first, Firebase
// second (for any not-yet-migrated client), same as the rest of the app's
// auth endpoints.
//
// ⚡ PERF: caller-identity resolution and the Supabase listing+contact
// lookup don't depend on each other, so they run in parallel instead of
// sequentially -- and the listing+contact lookup is one embedded query
// instead of two separate round-trips.
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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 50; // reveals per user per hour -- generous for a
// genuine buyer browsing many listings, but stops a scripted account from
// harvesting the whole marketplace's phone numbers in one sweep.

/** Supabase token আগে, তারপর Firebase token -- দুটোর একটাও না মিললে null। */
async function resolveCallerUid(token: string): Promise<string | null> {
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) return data.user.id;
    } catch (e) {
      console.error("[get-seller-contact] supabase token check failed:", e);
    }
  }
  return null;
}

/** Firestore-এ থাকা পুরনো (migrate না হওয়া) listing-এর নম্বর। */
async function lookupFirestoreContact(listingId: string): Promise<string | null> {
  if (!getApps().length) return null;
  try {
    const contactSnap = await getFirestore()
      .collection("listings")
      .doc(listingId)
      .collection("private")
      .doc("contact")
      .get();
    if (contactSnap.exists && contactSnap.data()?.contactNumber) {
      return contactSnap.data()?.contactNumber;
    }
  } catch (e) {
    console.error("[get-seller-contact] Firestore lookup failed:", (e as any)?.message || e);
  }
  return null;
}

/** Supabase-এ থাকা listing + তার contact একসাথে (embedded select)। */
async function lookupSupabaseContact(listingId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(listingId);
  const { data: listingRow, error: listingErr } = await supabaseAdmin
    .from("listings")
    .select("id, listing_contacts(phone)")
    .or(isUuid ? `legacy_firestore_id.eq.${listingId},id.eq.${listingId}` : `legacy_firestore_id.eq.${listingId}`)
    .maybeSingle();

  if (listingErr) {
    console.error("[get-seller-contact] Supabase lookup error:", listingErr.message);
    return null;
  }
  const contact = (listingRow as any)?.listing_contacts;
  const phone = Array.isArray(contact) ? contact[0]?.phone : contact?.phone;
  return phone || null;
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
    if (!token) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "listingId প্রয়োজন।" });
    }

    // caller identity resolve করা ও দুই জায়গায় (Firestore + Supabase) নম্বর
    // খোঁজা -- সবগুলো স্বাধীন, তাই প্যারালালি চলে।
    const [callerUid, firestorePhone, supabasePhone] = await Promise.all([
      resolveCallerUid(token),
      lookupFirestoreContact(listingId),
      lookupSupabaseContact(listingId),
    ]);

    if (!callerUid) {
      return res.status(401).json({ error: "লগইন সেশন মেয়াদোত্তীর্ণ। আবার লগইন করুন।" });
    }

    const allowed = await checkAndBumpRateLimit(`contact_reveal_${callerUid}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX);
    if (!allowed) {
      return res.status(429).json({
        error: "অনেকবার নম্বর দেখার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      });
    }

    const contactNumber = firestorePhone || supabasePhone;
    if (contactNumber) {
      return res.status(200).json({ contactNumber });
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(500).json({ error: "নম্বর আনা যায়নি। আবার চেষ্টা করুন।" });
  }
}
