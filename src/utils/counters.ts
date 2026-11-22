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

/** টিপস (YouTube) ভিডিওর ভিউ +১ (Supabase) -- সেশনে একবার, TipsFeed থেকে কল হয়। */
export async function incrementTipView(videoId: string): Promise<void> {
  try {
    await supabase.rpc("increment_tip_view", { p_video_id: videoId });
  } catch (err) {
    logger.debug("Failed to increment tip view (Supabase):", err);
  }
}

/** শুধু এডমিনের জন্য: টিপস ভিডিওগুলোর ভিউ সংখ্যা (অন্যরা খালি পাবে)। */
export async function getTipViews(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const { data } = await supabase.rpc("get_tip_views", { p_ids: ids });
    (data || []).forEach((r: any) => { out[String(r.video_id)] = Number(r.views) || 0; });
  } catch (err) {
    logger.debug("Failed to read tip views (Supabase):", err);
  }
  return out;
}
