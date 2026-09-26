import { createClient } from "@supabase/supabase-js";

// 🔧 (2026-09-26) Full migration off Firestore. This cron used to:
//   1. Drain Firestore's sharded view/save counters (counterShards) into
//      the parent listing doc -- that sharding pattern existed purely to
//      work around Firestore's ~1 write/sec/document ceiling under high
//      concurrent traffic. Postgres has no such ceiling (an UPDATE ...
//      SET x = x + 1 handles concurrent callers fine via row locking), and
//      api/track-event.ts's bump_listing_counter() already increments
//      Supabase's listings.views/clicks directly -- there's no sharded
//      counter to drain anymore, so that whole step is gone.
//   2. Purge old soft-deleted listings and old chat messages from
//      Firestore -- but listings and chat_messages have lived in Supabase
//      since the migration, so this was cleaning up a shrinking, stale
//      dataset while the real data it should have been purging (Supabase)
//      was never touched. Both purges now target Supabase directly.
const RETENTION_DAYS_LISTINGS = 30;
const RETENTION_DAYS_MESSAGES = 180;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function purgeOldSoftDeletedListings(supabase: ReturnType<typeof createClient>): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS_LISTINGS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: findErr } = await supabase
    .from("listings")
    .select("id")
    .eq("is_deleted", true)
    .lt("deleted_at", cutoff);
  if (findErr) throw findErr;
  const ids = (candidates || []).map((r: any) => r.id);
  if (ids.length === 0) return 0;

  // listing_contacts and saved_listings both have ON DELETE CASCADE back to
  // listings, so deleting the listing row cleans those up automatically.
  // chats.listing_id does NOT cascade (it's NO ACTION -- verified against
  // the live schema) since a chat's history should survive its listing
  // being purged. Without nulling it out first, deleting a listing that
  // still has a chat thread pointing at it would throw a foreign-key
  // violation and abort the ENTIRE batch delete below -- silently
  // cancelling the whole day's purge, not just that one listing.
  const { error: chatsErr } = await supabase.from("chats").update({ listing_id: null }).in("listing_id", ids);
  if (chatsErr) console.error("[maintenance] chats.listing_id cleanup error:", chatsErr.message);

  const { error: deleteErr } = await supabase.from("listings").delete().in("id", ids);
  if (deleteErr) throw deleteErr;

  return ids.length;
}

async function purgeOldChatMessages(supabase: ReturnType<typeof createClient>): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS_MESSAGES * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("chat_messages").delete().lt("created_at", cutoff).select("id");
  if (error) throw error;
  return (data || []).length;
}

export default async function handler(req: any, res: any) {
  // Was: `if (process.env.CRON_SECRET && authHeader !== ...)` -- if the env
  // var simply wasn't set in Vercel, that condition was false and this
  // whole check was skipped entirely, leaving the endpoint wide open for
  // anyone to hit repeatedly and burn through the database. Now: a missing
  // CRON_SECRET is itself a hard failure, not an open door.
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[maintenance] Missing Supabase env vars.");
    res.status(500).json({ error: "Server misconfigured: Supabase env vars missing." });
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const listingsPurged = await purgeOldSoftDeletedListings(supabase);
    const messagesPurged = await purgeOldChatMessages(supabase);

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
