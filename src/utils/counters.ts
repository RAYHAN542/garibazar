import { doc, setDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Distributed ("sharded") counters
// ---------------------------------------------------------------------------
// Firestore reliably sustains only ~1 write/second to any single document.
// A popular listing getting many views or saves in quick succession would
// previously hammer that ONE listing document directly (`views: increment(1)`
// on the main doc), which is exactly the kind of hot-document contention this
// pattern avoids: instead of writing to the main doc, every increment writes
// to one of NUM_SHARDS small sibling documents, chosen at random. Writes get
// spread across many documents so no single doc is a bottleneck.
//
// The tradeoff: reading the *true* current total now means reading all
// NUM_SHARDS shard docs and summing them, which is too expensive to do on
// every listing card render. So the main listing document keeps a `views` /
// `savedCount` field as a periodically-refreshed cache -- a scheduled job
// (see /api/cron/aggregate-counters.ts) sums the shards and writes the total
// back every few minutes. Between runs the displayed count can be a few
// minutes stale, which is an acceptable tradeoff for a view/save counter.

const NUM_SHARDS = 10;

function randomShardId(): string {
  return String(Math.floor(Math.random() * NUM_SHARDS));
}

/**
 * Bump a listing's view count by 1, via the sharded pattern (does not touch
 * the main listing document). Safe to call for anonymous visitors.
 */
export async function incrementListingViewShard(listingId: string): Promise<void> {
  try {
    const shardRef = doc(db, "listings", listingId, "counterShards", randomShardId());
    await setDoc(shardRef, { views: increment(1) }, { merge: true });
  } catch (err) {
    // Best-effort analytics -- never block the UI on this failing.
    logger.debug("Failed to increment view shard:", err);
  }
}

/**
 * Bump (delta = 1) or un-bump (delta = -1) a listing's "saved to dashboard"
 * count, via the same sharded pattern. Requires the caller to be signed in
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
