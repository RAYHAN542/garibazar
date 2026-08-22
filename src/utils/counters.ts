import { doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Distributed ("sharded") counters -- used for SAVES only
// ---------------------------------------------------------------------------
// Firestore reliably sustains only ~1 write/second to any single document.
// A popular listing getting many saves in quick succession would previously
// hammer that ONE listing document directly (`savedCount: increment(1)` on
// the main doc), which is exactly the kind of hot-document contention this
// pattern avoids: instead of writing to the main doc, every increment writes
// to one of NUM_SHARDS small sibling documents, chosen at random. Writes get
// spread across many documents so no single doc is a bottleneck.
//
// The tradeoff: reading the *true* current total now means reading all
// NUM_SHARDS shard docs and summing them, which is too expensive to do on
// every listing card render. So the main listing document keeps a
// `savedCount` field as a periodically-refreshed cache -- a scheduled job
// (see /api/cron/maintenance.ts) sums the shards and writes the total back.
// On Vercel's free plan this only runs once a day, so the displayed count
// can be up to a day stale between runs -- an acceptable tradeoff for a
// "saved by X people" count that nobody checks in real time.
//
// Views used to go through this same sharded path, but that made the view
// counter shown on a listing look like it "reset" every time someone
// reloaded the app the same day (the shard write happened, but the cached
// total on the listing doc wouldn't catch up until the next 2 AM cron run).
// At GariBazar's current traffic (nowhere near 1 write/sec to any single
// listing), that tradeoff isn't worth it for views, so incrementListingView
// below writes straight to the listing doc instead -- see the `views`
// update rule in firestore.rules, which already allows exactly this
// (anyone may bump views by +1, capped to a single increment per write).
// ---------------------------------------------------------------------------

const NUM_SHARDS = 10;

function randomShardId(): string {
  return String(Math.floor(Math.random() * NUM_SHARDS));
}

/**
 * Bump a listing's view count by 1, directly and in real time (not via the
 * shard/cron pattern -- see comment above for why). Safe to call for
 * anonymous visitors; firestore.rules independently caps this to +1 per
 * write so it can't be abused to inflate the counter arbitrarily.
 */
export async function incrementListingView(listingId: string): Promise<void> {
  try {
    const listingRef = doc(db, "listings", listingId);
    await updateDoc(listingRef, { views: increment(1) });
  } catch (err) {
    // Best-effort analytics -- never block the UI on this failing.
    logger.debug("Failed to increment view:", err);
  }
}

/**
 * Bump (delta = 1) or un-bump (delta = -1) a listing's "saved to dashboard"
 * count, via the sharded pattern. Requires the caller to be signed in
 * (enforced by firestore.rules).
 */
export async function incrementListingSavedShard(listingId: string, delta: 1 | -1): Promise<void> {
  try {
    const shardRef = doc(db, "listings", listingId, "counterShards", randomShardId());
    await setDoc(shardRef, { saved: increment(delta) }, { merge: true });
  } catch (err) {
    logger.debug("Failed to increment saved shard:", err);
  }
}
