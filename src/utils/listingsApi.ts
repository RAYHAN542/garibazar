import { supabase } from "../supabase";
import { PartListing } from "../types";

// ---------------------------------------------------------------------------
// Phase 1 of the Firebase -> Supabase migration: the LISTINGS READ path only
// (homepage browse, "Load More", the boosted-ad banner). Nothing here writes
// yet -- creating/editing/deleting a listing, and view/click/save tracking,
// still go through Firestore/api/track-event.ts for now. This keeps the
// first cut small and independently testable: if something's wrong here,
// only the browse experience is affected, not listing creation, chat,
// payments, or auth.
//
// listings table columns are snake_case (Postgres convention); PartListing
// (src/types.ts) is camelCase and used by every existing component
// (ListingCard, ListingDetailModal, AdminPanel, etc.) -- mapRowToListing is
// the only place that needs to know about that difference, so nothing
// downstream of this file has to change in this phase.
// ---------------------------------------------------------------------------

const INITIAL_FETCH_LIMIT = 20;

export function mapRowToListing(row: any): PartListing {
  const images: string[] = Array.isArray(row.images) ? row.images : [];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    subCategory: row.sub_category ?? undefined,
    type: row.type ?? undefined,
    brand: row.brand ?? undefined,
    model: row.model,
    price: Number(row.price),
    description: row.description,
    sellerName: row.seller_name,
    image: images[0] || "",
    images,
    isVideo: row.is_video ?? undefined,
    hasVideo: row.has_video ?? undefined,
    videoUrl: row.video_url ?? undefined,
    isAd: !!row.is_ad,
    adTier: row.ad_tier || "none",
    createdAt: row.created_at,
    views: row.views ?? 0,
    clicks: row.clicks ?? 0,
    location: row.location,
    sellerId: row.seller_id,
    isSold: row.is_sold ?? undefined,
    reportCount: row.report_count ?? undefined,
    reportedBy: Array.isArray(row.reported_by) ? row.reported_by : undefined,
    adExpiresAt: row.ad_expires_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    sellerRating: row.seller_rating != null ? Number(row.seller_rating) : undefined,
    sellerReviewCount: row.seller_review_count ?? undefined,
    dailyStats: row.daily_stats ?? undefined,
  } as PartListing;
}

export interface ListingsPage {
  listings: PartListing[];
  /** Cursor to pass as `before` on the next call; null once exhausted. */
  nextCursor: string | null;
  /** True if this page came back full (there may be more after it). */
  hasMore: boolean;
}

export async function fetchInitialListings(limit = INITIAL_FETCH_LIMIT): Promise<ListingsPage> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = data || [];
  const listings = rows.map(mapRowToListing);
  return {
    listings,
    nextCursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
    hasMore: rows.length === limit,
  };
}

export async function fetchMoreListings(beforeCreatedAt: string, limit = 20): Promise<ListingsPage> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = data || [];
  const listings = rows.map(mapRowToListing);
  return {
    listings,
    nextCursor: rows.length > 0 ? rows[rows.length - 1].created_at : beforeCreatedAt,
    hasMore: rows.length === limit,
  };
}

export async function fetchAdListings(limit = 20): Promise<PartListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_ad", true)
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapRowToListing);
}

// Seller's own listings for Dashboard/Lottery -- matches on both possible id
// forms (legacy uid and Supabase authUid), same pattern used elsewhere
// (PromoteAdModal, ListingDetailModal) since not every user has both set.
export async function fetchMyListings(uid: string, authUid?: string | null, limit = 100): Promise<PartListing[]> {
  const ids = Array.from(new Set([uid, authUid].filter(Boolean))) as string[];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .in("seller_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapRowToListing);
}

// 🔧 App.tsx-এ শেয়ার-করা লিংক (?listing=<id>) সরাসরি খোলার জন্য এতদিন
// সরাসরি Firestore getDoc() ব্যবহার হতো -- Supabase-এ migrate হওয়া
// নতুন listing (Firestore-এ কখনো ছিলই না) এভাবে খুললে সবসময় ব্যর্থ হতো।
export async function fetchListingById(id: string): Promise<PartListing | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRowToListing(data);
}

// 🔧 মেয়াদ শেষ হওয়া ad promotion রিসেট করাও আগে সরাসরি Firestore
// updateDoc() দিয়ে হতো -- একই কারণে নতুন (Supabase-only) listing-এর জন্য
// silently ব্যর্থ হতো, ad মেয়াদ শেষ হওয়ার পরও isAd:true থেকে যেত।
export async function resetExpiredAdPromotion(id: string): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ is_ad: false, ad_expires_at: null })
    .eq("id", id);
  if (error) throw error;
}
