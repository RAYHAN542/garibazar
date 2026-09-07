import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { randomInt } from "crypto";
import { applyCors } from "./_lib/cors.js";

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
      console.error("[draw] supabase token check failed:", e);
    }
  }
  if (getApps().length) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      return decoded.uid;
    } catch (e) {
      console.error("[draw] firebase token check failed:", (e as any)?.message || e);
    }
  }
  return null;
}

const getTodayInDhaka = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
};

const WIN_CHANCE_DENOMINATOR = 10;
const BOOST_DURATION_HOURS = 24;

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader;
    if (!token) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }
    const uid = await resolveCallerUid(token);
    if (!uid) {
      return res.status(401).json({ error: "অননুমোদিত অনুরোধ। প্রথমে লগইন করুন।" });
    }

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== "string") {
      return res.status(400).json({ error: "কোন প্রোডাক্টটি বুস্ট করতে চান, সেটি সিলেক্ট করুন।" });
    }

    const today = getTodayInDhaka();

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("last_lottery_date")
      .eq("uid", uid)
      .maybeSingle();

    if (userRow?.last_lottery_date === today) {
      return res.status(429).json({
        error: "আজকের লটারি ইতিমধ্যে ব্যবহার করেছেন। আগামীকাল আবার চেষ্টা করুন।",
        alreadyUsedToday: true,
      });
    }

    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("seller_id, is_ad, title")
      .eq("id", listingId)
      .maybeSingle();

    if (listingErr || !listing) {
      return res.status(404).json({ error: "প্রোডাক্টটি খুঁজে পাওয়া যায়নি।" });
    }
    if (listing.seller_id !== uid) {
      return res.status(403).json({ error: "এই প্রোডাক্টটি আপনার নয়।" });
    }
    if (listing.is_ad) {
      return res.status(400).json({ error: "এই প্রোডাক্টটি ইতিমধ্যে বিজ্ঞাপন হিসেবে লাইভ আছে।" });
    }

    const roll = randomInt(0, WIN_CHANCE_DENOMINATOR);
    const win = roll === 0;

    await supabaseAdmin
      .from("users")
      .update({ last_lottery_date: today })
      .eq("uid", uid);

    let adExpiresAt: string | null = null;
    if (win) {
      adExpiresAt = new Date(Date.now() + BOOST_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from("listings")
        .update({ is_ad: true, ad_tier: "featured", ad_expires_at: adExpiresAt })
        .eq("id", listingId);
    }

    await supabaseAdmin.from("lottery_draws").insert({
      uid,
      data: {
        listingId,
        listingTitle: listing.title || "",
        win,
        date: today,
      },
    });

    return res.status(200).json({ win, adExpiresAt });
  } catch (err: any) {
    console.error("lottery draw failed:", err);
    return res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
  }
}
