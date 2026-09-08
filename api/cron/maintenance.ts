import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const RETENTION_DAYS_LISTINGS = 30;
const RETENTION_DAYS_MESSAGES = 180;
const BATCH_LIMIT = 400;

// Listings live in Supabase -- hard-delete soft-deleted rows past
// retention so the table doesn't grow forever with dead listings.
async function purgeOldSoftDeletedListings(): Promise<number> {
  if (!supabaseAdmin) return 0;
  const cutoff = new Date(Date.now() - RETENTION_DAYS_LISTINGS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("listings")
    .delete()
    .eq("is_deleted", true)
    .lt("deleted_at", cutoff)
    .select("id")
    .limit(BATCH_LIMIT);
  if (error) {
    console.error("[maintenance] purgeOldSoftDeletedListings failed:", error.message);
    return 0;
  }
  return data?.length || 0;
}

// 🔧 Chat migrated Firestore -> Supabase: purge old chat_messages rows the
// same way listings are purged, instead of a Firestore collectionGroup batch
// delete. firebase-admin is no longer needed anywhere in this file.
async function purgeOldChatMessages(): Promise<number> {
  if (!supabaseAdmin) return 0;
  const cutoff = new Date(Date.now() - RETENTION_DAYS_MESSAGES * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .delete()
    .lt("created_at", cutoff)
    .select("id")
    .limit(BATCH_LIMIT);
  if (error) {
    console.error("[maintenance] purgeOldChatMessages failed:", error.message);
    return 0;
  }
  return data?.length || 0;
}

export default async function handler(req: any, res: any) {
  if (!process.env.CRON_SECRET) {
    console.error("[maintenance] CRON_SECRET is not set -- refusing to run.");
    res.status(500).json({ error: "Server misconfigured: CRON_SECRET not set." });
    return;
  }
  const authHeader = req.headers?.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const listingsPurged = await purgeOldSoftDeletedListings();
    const messagesPurged = await purgeOldChatMessages();

    res.status(200).json({
      success: true,
      listingsPurged,
      messagesPurged,
    });
  } catch (err: any) {
    console.error("[maintenance] failed:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
