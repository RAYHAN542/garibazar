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
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Firestore-era auto-generated doc IDs are alphanumeric base62-ish strings.
// Anything outside this charset is never a real legacy id.
const SAFE_LEGACY_ID = /^[A-Za-z0-9_-]{1,64}$/;

function mapRowToListing(row: any): PartListing {
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
    adImpressions: row.ad_impressions ?? 0,
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

export interface CategoryFilters {
  /** "vehicles" | "spare_parts" | "all" (or undefined/omitted = no filter) */
  category?: string;
  /** e.g. "car" | "bike" | "truck" | "excavator" | "other_heavy_equipment" | "all" */
  subCategory?: string;
}

// 🔧 (2026-09-26) Applies the category/sub-category filter AT THE DATABASE,
// not after fetching. Before this, the homepage always pulled the newest 20
// listings of ANY type and filtered client-side -- for a minority
// sub-category like "excavator" (72 out of hundreds of listings, but every
// single one older than the last ~150 posts), that meant "Load More" had to
// scan hundreds of irrelevant newer car listings before finding even one
// match, so a filter like "Heavy Equip." looked almost empty even though
// plenty of matching listings genuinely existed. Now the query itself only
// asks Postgres for rows that already match, so the very first page is full
// of real results regardless of how old or rare that category is.
function applyCategoryFilters(query: any, filters?: CategoryFilters) {
  if (!filters) return query;
  if (filters.category === "vehicles") {
    query = query.eq("category", "vehicles");
  } else if (filters.category === "spare_parts") {
    query = query.neq("category", "vehicles");
  }
  if (filters.subCategory && filters.subCategory !== "all") {
    if (filters.subCategory === "other_heavy_equipment") {
      // "Heavy Equip." is meant to surface every kind of heavy machinery at
      // once, not just whatever didn't fit a more specific sub-category.
      query = query.in("sub_category", ["other_heavy_equipment", "excavator", "crane", "bulldozer", "forklift"]);
    } else {
      query = query.eq("sub_category", filters.subCategory);
    }
  }
  return query;
}

export async function fetchInitialListings(limit = INITIAL_FETCH_LIMIT, filters?: CategoryFilters): Promise<ListingsPage> {
  let query = supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false);
  query = applyCategoryFilters(query, filters);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) throw error;
  const rows = data || [];
  const listings = rows.map(mapRowToListing);
  return {
    listings,
    nextCursor: rows.length > 0 ? rows[rows.length - 1].created_at : null,
    hasMore: rows.length === limit,
  };
}

export async function fetchMoreListings(beforeCreatedAt: string, limit = 20, filters?: CategoryFilters): Promise<ListingsPage> {
  let query = supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .lt("created_at", beforeCreatedAt);
  query = applyCategoryFilters(query, filters);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) throw error;
  const rows = data || [];
  const listings = rows.map(mapRowToListing);
  return {
    listings,
    nextCursor: rows.length > 0 ? rows[rows.length - 1].created_at : beforeCreatedAt,
    hasMore: rows.length === limit,
  };
}

// 🔧 (2026-09-28) The caller used to pass 20, which silently capped the
// boosted-ad pool at 20 -- with fair rotation (src/utils/adRotation.ts)
// every boosted ad must be able to take its turn, so the pool has to hold
// ALL of them. Callers can still ask for fewer, but never less than this
// floor.
const AD_POOL_MIN_LIMIT = 300;

export async function fetchAdListings(limit = 20): Promise<PartListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .eq("is_ad", true)
    .order("created_at", { ascending: false })
    .limit(Math.max(limit, AD_POOL_MIN_LIMIT));

  if (error) throw error;
  return (data || []).map(mapRowToListing);
}

// 🔧 (2026-09-24) Added: App.tsx's "My Own Listings" (Dashboard, My Shop,
// the lottery's list of eligible posts) was still querying Firestore's
// `listings` collection by sellerId. Every listing created after the
// Supabase migration lives only in Postgres now (see AddPartForm.tsx), so
// that Firestore query always came back empty for any post made since the
// migration -- Dashboard/My Shop showed "0 posts" even right after a
// successful post, even though the listing was live on the homepage (which
// *does* read from Supabase). This fetches a seller's own listings from the
// same table the rest of the app already reads from.
export async function fetchMyListings(sellerId: string, limit = 100): Promise<PartListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", sellerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapRowToListing);
}

// 🔧 (2026-09-26) Added for AdminPanel.tsx's "Manage Listings" tab, which
// was still querying Firestore (collection(db,"listings")) and so always
// came back empty for anything posted since the Supabase migration. Same
// mapping as everything else in this file, just without a seller filter and
// with a larger default limit (the admin panel manages the whole
// marketplace, not one seller's posts).
export async function fetchAdminListings(limit = 300): Promise<PartListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapRowToListing);
}

// 🔧 (2026-09-27) Added for App.tsx's shared-link direct-open path
// (?listing=<id>), which was still doing a Firestore getDoc() -- listings
// live in Supabase now, so that always found nothing for a listing created
// since the migration. Same dual id/legacy_firestore_id lookup pattern
// used server-side (api/share-listing.ts, api/get-seller-contact.ts,
// api/draw.ts), since an older shared link may carry a pre-migration id.
//
// 🔧 (2026-10-01 security audit) `id` is interpolated straight into a
// PostgREST .or() filter string below -- supabase-js does not escape raw
// .or() strings, so a crafted comma could previously append an unintended
// extra OR condition. RLS still only ever allows public listing fields to
// be read either way, so this was never a private-data exposure, but
// validating the id's shape here closes the injection vector directly
// instead of relying on that being coincidentally harmless.
export async function fetchListingById(id: string): Promise<PartListing | null> {
  const isUuid = UUID_RE.test(id);
  if (!isUuid && !SAFE_LEGACY_ID.test(id)) return null;
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .or(isUuid ? `legacy_firestore_id.eq.${id},id.eq.${id}` : `legacy_firestore_id.eq.${id}`)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapRowToListing(data);
}
