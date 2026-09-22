import { doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { supabase } from "../supabase";
import { logger } from "./logger";

const NUM_SHARDS = 10;

function randomShardId(): string {
  return String(Math.floor(Math.random() * NUM_SHARDS));
}

/**
 * Bump a listing's view count by 1 in Supabase (via a safe RPC function
 * that can only ever do +1, nothing else -- RLS otherwise blocks anonymous
 * writes to listings).
 */
export async function incrementListingView(listingId: string): Promise<void> {
  try {
    await supabase.rpc("increment_listing_view", { p_legacy_id: listingId });
  } catch (err) {
    logger.debug("Failed to increment view (Supabase):", err);
  }
}

export async function incrementListingViewFirestore(listingId: string): Promise<void> {
  try {
    const listingRef = doc(db, "listings", listingId);
    await updateDoc(listingRef, { views: increment(1) });
  } catch (err) {
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

/**
 * Bump a listing's click count by 1 (Supabase) -- e.g. when someone opens
 * the listing detail view.
 */
export async function trackListingClick(listingId: string): Promise<void> {
  try {
    await supabase.rpc("increment_listing_click", { p_legacy_id: listingId });
  } catch (err) {
    logger.debug("Failed to increment click (Supabase):", err);
  }
}
