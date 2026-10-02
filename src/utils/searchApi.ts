import { supabase } from "../supabase";
import { PartListing } from "../types";

// Server-side search over the WHOLE listings table (not just the ~20 posts
// the homepage has loaded). Free-text tokens are ANDed together; each token
// can match title/brand/model/description/location. Special characters are
// stripped so user input can never break out of the PostgREST .or() filter.

export interface SearchParams {
  tokens: string[];
  type?: string; // all | car | bike | truck | other_heavy_equipment | parts
  brand?: string;
  model?: string;
  city?: string; // first word of the city name, e.g. "Dhaka"
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: string; // latest | priceAsc | priceDesc
  limit?: number;
}

const clean = (s: string) => String(s || "").replace(/[%_*,()"'\\]/g, " ").replace(/\s+/g, " ").trim();

function mapRow(row: any): PartListing {
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

export async function searchListings(p: SearchParams): Promise<PartListing[]> {
  let q: any = supabase.from("listings").select("*").eq("is_deleted", false);

  for (const raw of p.tokens.slice(0, 6)) {
    const t = clean(raw);
    if (!t) continue;
    q = q.or(`title.ilike.%${t}%,brand.ilike.%${t}%,model.ilike.%${t}%,description.ilike.%${t}%,location.ilike.%${t}%`);
  }

  const brand = clean(p.brand || "");
  if (brand) q = q.or(`title.ilike.%${brand}%,brand.ilike.%${brand}%,model.ilike.%${brand}%`);

  const model = clean(p.model || "");
  if (model) q = q.or(`title.ilike.%${model}%,model.ilike.%${model}%`);

  if (p.type === "parts") {
    q = q.neq("category", "vehicles");
  } else if (p.type && p.type !== "all") {
    q = q.eq("category", "vehicles");
    if (p.type === "other_heavy_equipment") {
      q = q.in("sub_category", ["other_heavy_equipment", "excavator", "crane", "bulldozer", "forklift"]);
    } else {
      q = q.eq("sub_category", p.type);
    }
  }

  const city = clean(p.city || "");
  if (city) q = q.ilike("location", `%${city}%`);
  if (p.minPrice != null) q = q.gte("price", p.minPrice);
  if (p.maxPrice != null) q = q.lte("price", p.maxPrice);

  if (p.sort === "priceAsc") q = q.order("price", { ascending: true });
  else if (p.sort === "priceDesc") q = q.order("price", { ascending: false });
  else q = q.order("created_at", { ascending: false });

  const { data, error } = await q.limit(p.limit ?? 100);
  if (error) throw error;
  return (data || []).map(mapRow);
}
