import { supabase } from "../supabase";
import { logger } from "./logger";

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
