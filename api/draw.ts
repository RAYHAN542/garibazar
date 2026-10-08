import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";
import { applyCors } from "./_lib/cors.js";
import { verifySupabaseToken } from "./_lib/verifyJwt.js";

// 🔧 (2026-09-24) এই এন্ডপয়েন্ট আগে সম্পূর্ণ Firebase+Firestore নির্ভর ছিল --
// migration-পরবর্তী কোনো listing-ই খুঁজে পেত না। এখন users/listings/
// lottery_draws সবই Supabase থেকে পড়া/লেখা হয়।
//
// 🔧 (2026-10-XX) Firebase ID-token fallback পুরোপুরি সরানো হলো -- phone
// login (একমাত্র সক্রিয় লগইন পদ্ধতি) অনেক আগেই ১০০% Supabase-এ চলে
// গেছে, কোনো আসল ইউজারের কাছে আর বৈধ Firebase ID token নেই। এখন থেকে
// শুধু Supabase session token-ই যাচাই করা হয়।
const getTodayInDhaka = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }); // YYYY-MM-DD
};

// জেতার সম্ভাবনা ঠিক ১০ জনের মধ্যে ১ জন (১০%)। ক্রিপ্টো-সিকিউর random ব্যবহার করা হচ্ছে
// যাতে ক্লায়েন্ট সাইড থেকে ম্যানিপুলেট করা সম্ভব না হয় — পুরো ড্র সার্ভারেই হয়।
const WIN_CHANCE_DENOMINATOR = 10;
const BOOST_DURATION_HOURS = 24;

// Firestore-era auto-generated doc IDs are 20-char base62-ish strings --
// alphanumeric only. Anything outside that charset is never a real legacy
// id, so there's no reason to let it anywhere near a PostgREST filter string.
const SAFE_LEGACY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify the caller is signed in -- Supabase session token only.
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.replace("Bearer ", "");
    if (!idToken) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }
    const uid = await verifySupabaseToken(idToken);
    if (!uid) {
      return res.status(401).json({ error: "যাচাই ব্যর্থ হয়েছে।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "কোন প্রোডাক্টটি বুস্ট করতে চান, সেটি সিলেক্ট করুন।" });
    }

    const today = getTodayInDhaka();

    // 2. Enforce one draw per user per day
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("last_lottery_date")
      .eq("uid", uid)
      .maybeSingle();
    if (userErr) {
      console.error("lottery draw: users lookup error:", userErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    }
    if (userRow?.last_lottery_date === today) {
      return res.status(429).json({
        error: "আজকের লটারি ইতিমধ্যে ব্যবহার করেছেন। আগামীকাল আবার চেষ্টা করুন।",
        alreadyUsedToday: true,
      });
    }

    // 3. Validate the listing belongs to this user and isn't already boosted.
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(listingId);
    if (!isUuid && !SAFE_LEGACY_ID.test(listingId)) {
      return res.status(404).json({ error: "প্রোডাক্টটি খুঁজে পাওয়া যায়নি।" });
    }
    const { data: listingRow, error: listingErr } = await supabase
      .from("listings")
      .select("id, seller_id, title, is_ad")
      .or(isUuid ? `legacy_firestore_id.eq.${listingId},id.eq.${listingId}` : `legacy_firestore_id.eq.${listingId}`)
      .maybeSingle();
    if (listingErr) {
      console.error("lottery draw: listings lookup error:", listingErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    }
    if (!listingRow) {
      return res.status(404).json({ error: "প্রোডাক্টটি খুঁজে পাওয়া যায়নি।" });
    }
    if (listingRow.seller_id !== uid) {
      return res.status(403).json({ error: "এই প্রোডাক্টটি আপনার নয়।" });
    }
    if (listingRow.is_ad) {
      return res.status(400).json({ error: "এই প্রোডাক্টটি ইতিমধ্যে বিজ্ঞাপন হিসেবে লাইভ আছে।" });
    }

    // Atomic claim: only one concurrent request can win today's draw slot.
    // This IS the "mark today as used" step -- nothing further needed later.
    const { data: claimed, error: claimErr } = await supabase
      .from("users")
      .update({ last_lottery_date: today })
      .eq("uid", uid)
      .or(`last_lottery_date.is.null,last_lottery_date.neq.${today}`)
      .select("uid")
      .maybeSingle();
    if (claimErr) {
      console.error("lottery draw: claim error:", claimErr.message);
      return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    }
    if (!claimed) {
      return res.status(429).json({
        error: "আজকের লটারি ইতিমধ্যে ব্যবহার করেছেন। আগামীকাল আবার চেষ্টা করুন।",
        alreadyUsedToday: true,
      });
    }

    // 4. Draw — exactly 1-in-10 (10%) chance, server-side crypto RNG
    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR); // 0..9
    const win = roll === 0;

    let adExpiresAt: string | null = null;
    if (win) {
      adExpiresAt = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      const { error: boostErr } = await supabase
        .from("listings")
        .update({ is_ad: true, ad_tier: "featured", ad_expires_at: adExpiresAt })
        .eq("id", listingRow.id);
      if (boostErr) {
        console.error("lottery draw: failed to apply boost:", boostErr.message);
        return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
      }
    }

    // Audit trail for admin visibility
    const { error: auditErr } = await supabase.from("lottery_draws").insert({
      uid,
      data: {
        listingId: listingRow.id,
        listingTitle: listingRow.title || "",
        win,
        date: today,
        createdAt: new Date().toISOString(),
      },
    });
    if (auditErr) {
      console.error("lottery draw: failed to write audit row:", auditErr.message);
    }

    return res.status(200).json({ win, adExpiresAt });
  } catch (err: any) {
    console.error("lottery draw failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
}
