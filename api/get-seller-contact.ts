import { applyCors } from "./_lib/cors.js";
import { checkAndBumpRateLimit } from "./_lib/rateLimit.js";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------------
// 🔧 Fixes: "seller contact scrape risk" (audit item -- private contact
// leak, High priority).
//
// The "Show Number" feature itself is legitimate and intentionally open to
// any signed-in visitor (this is a normal marketplace pattern, not a bug
// on its own) -- so the fix is NOT to restrict *who* can see a number,
// it's to rate-limit *how many* a single account can reveal, the same
// pattern already used for Cloudinary uploads and listing/message
// cooldowns.
//
// 🔧 Firebase -> Supabase migration complete: every listing's contact
// number now lives in Supabase's listing_contacts table (verified: 0 of
// 479 migrated listings are missing a contact row). The Firestore
// fallback lookup has been removed along with firebase-admin.
// ------------------------------------------------------------------------

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

async function resolveCallerUid(token: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data?.user?.id) return data.user.id;
  } catch (e) {
    console.error("[get-seller-contact] supabase token check failed:", e);
  }
  return null;
}

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

    const [callerUid, contactNumber] = await Promise.all([
      resolveCallerUid(token),
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

    if (contactNumber) {
      return res.status(200).json({ contactNumber });
    }

    return res.status(404).json({ error: "নম্বর পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("[get-seller-contact] error:", err?.message || err);
    return res.status(500).json({ error: "নম্বর আনা যায়নি। আবার চেষ্টা করুন।" });
  }
}
