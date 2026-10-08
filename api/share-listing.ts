import { createClient } from "@supabase/supabase-js";

// 🔧 (2026-09-26) Migrated primary lookup off Firestore -- listings have
// lived in Supabase since the migration (see src/utils/listingsApi.ts).
//
// 🔧 (2026-10-XX, Firebase removal) The Firestore fallback for genuinely
// pre-migration links is gone -- any listing never imported into Supabase
// now gets the generic site-wide fallback preview card instead of its real
// title/price/photo. That's a shrinking, already-rare case (every listing
// posted since the migration has always lived in Supabase only).
const SITE_URL = "https://garibazar.shop";
const DEFAULT_IMAGE = `${SITE_URL}/og-banner.jpg`;
const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Pinterest|Discordbot|redditbot|Googlebot|bingbot|DuckDuckBot|Applebot|YandexBot|Baiduspider/i;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Firestore-era auto-generated doc IDs are alphanumeric base62-ish strings.
// Anything outside this charset is never a real legacy id.
const SAFE_LEGACY_ID = /^[A-Za-z0-9_-]{1,64}$/;

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function lookupListingFromSupabase(id: string): Promise<{ title: string; price?: number; location?: string; images?: string[] } | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const isUuid = UUID_RE.test(id);
  // 🔧 (2026-10-01 security audit) `id` is interpolated straight into a
  // PostgREST .or() filter string below -- supabase-js doesn't escape raw
  // .or() strings, so validating the id's shape first closes the filter-
  // injection vector outright (no private data is exposed either way, this
  // is a public preview-card lookup).
  if (!isUuid && !SAFE_LEGACY_ID.test(id)) return null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("listings")
    .select("title, brand, model, price, location, images")
    .or(isUuid ? `legacy_firestore_id.eq.${id},id.eq.${id}` : `legacy_firestore_id.eq.${id}`)
    .maybeSingle();

  if (error) {
    console.error("share-listing: Supabase lookup error:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    title: data.title || `${data.brand || ""} ${data.model || ""}`.trim() || "গাড়ি/পার্টস বিজ্ঞাপন",
    price: data.price != null ? Number(data.price) : undefined,
    location: data.location || undefined,
    images: Array.isArray(data.images) ? data.images : undefined,
  };
}

export default async function handler(req: any, res: any) {
  const id = (req.query?.id || "").toString();
  const appUrl = id ? `${SITE_URL}/?listing=${id}` : SITE_URL;
  const shareUrl = id ? `${SITE_URL}/l/${id}` : SITE_URL;
  const userAgent = req.headers["user-agent"] || "";
  const isCrawler = CRAWLER_UA.test(userAgent);

  // Real visitors (not a social-media crawler) just get sent straight into the app.
  if (!isCrawler) {
    res.writeHead(302, { Location: appUrl });
    return res.end();
  }

  // Default (fallback) values in case the listing can't be loaded.
  let title = "গাড়ি বাজার (Gari Bazar) - Auto Spares Marketplace";
  let description = "খুব সহজেই এবং নিরাপদে গাড়ি ও বাইকের জেনুইন স্পেয়ার পার্টস কেনা-বেচা করুন গাড়ি বাজার-এ।";
  let image = DEFAULT_IMAGE;

  try {
    if (id) {
      const supabaseListing = await lookupListingFromSupabase(id);
      if (supabaseListing) {
        const priceText = supabaseListing.price ? `৳${Number(supabaseListing.price).toLocaleString("en-BD")}` : "মূল্য জানতে যোগাযোগ করুন";
        title = `${supabaseListing.title} - গাড়ি বাজার`;
        description = [priceText, supabaseListing.location].filter(Boolean).join(" | ");
        if (supabaseListing.images && supabaseListing.images[0]) {
          image = supabaseListing.images[0];
        }
      }
    }
  } catch (err) {
    console.error("share-listing lookup failed:", err);
  }

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(shareUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
<a href="${escapeHtml(appUrl)}">${escapeHtml(title)}</a>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(html);
}
