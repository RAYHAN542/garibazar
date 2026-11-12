import { createClient } from "@supabase/supabase-js";
import { browseHandler } from "./_lib/browse.js";
import { sitemapHandler } from "./_lib/sitemap.js";

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
const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Pinterest|Discordbot|redditbot|Googlebot|Mediapartners-Google|AdsBot-Google|Google-InspectionTool|bingbot|DuckDuckBot|Applebot|YandexBot|Baiduspider/i;
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

type ListingPreview = {
  title: string;
  price?: number;
  location?: string;
  images?: string[];
  description?: string;
  brand?: string;
  model?: string;
  isSold?: boolean;
  isDeleted?: boolean;
};

async function lookupListingFromSupabase(id: string): Promise<ListingPreview | null> {
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
    .select("title, brand, model, price, location, images, description, is_sold, is_deleted")
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
    description: data.description || undefined,
    brand: data.brand || undefined,
    model: data.model || undefined,
    isSold: data.is_sold === true,
    isDeleted: data.is_deleted === true,
  };
}

export default async function handler(req: any, res: any) {
  // /browse and /sitemap.xml are rewritten here (see vercel.json) so the
  // project stays within Vercel's 12-function limit.
  if (req.query?.mode === "browse") return browseHandler(req, res);
  if (req.query?.mode === "sitemap") return sitemapHandler(req, res);
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
  let bodyHtml = "";
  let jsonLd = "";
  let removed = false;

  try {
    if (id) {
      const supabaseListing = await lookupListingFromSupabase(id);
      if (supabaseListing && supabaseListing.isDeleted) {
        // Deleted listings: tell search engines the page is gone.
        removed = true;
        title = "বিজ্ঞাপনটি আর নেই - গাড়ি বাজার";
        description = "এই বিজ্ঞাপনটি মুছে ফেলা হয়েছে।";
      } else if (supabaseListing) {
        const hasPrice = typeof supabaseListing.price === "number" && supabaseListing.price > 0;
        const priceText = hasPrice ? `৳${Number(supabaseListing.price).toLocaleString("en-BD")}` : "মূল্য জানতে যোগাযোগ করুন";
        // Search-result title: name + price + place, only the parts that really exist.
        const loc = supabaseListing.location ? supabaseListing.location.trim() : "";
        title = `${supabaseListing.title} - ${hasPrice ? priceText : "যোগাযোগ করুন"}${loc ? `, ${loc}` : ""} | গাড়ি বাজার`;
        const esc = escapeHtml;
        const imgs = (supabaseListing.images || []).filter((s) => typeof s === "string" && /^https?:\/\//.test(s)).slice(0, 4);
        const specs = [supabaseListing.brand, supabaseListing.model].filter(Boolean).join(" ");
        bodyHtml = `<h1>${esc(supabaseListing.title)}</h1>
<p><strong>${esc(priceText)}</strong>${supabaseListing.location ? " | " + esc(supabaseListing.location) : ""}</p>
${specs ? `<p>ব্র্যান্ড/মডেল: ${esc(specs)}</p>` : ""}
${supabaseListing.description ? `<h2>বিবরণ</h2><p>${esc(supabaseListing.description).replace(/\n/g, "<br>")}</p>` : ""}
${imgs.map((src) => `<img src="${esc(src)}" alt="${esc(supabaseListing.title)}" width="480" loading="lazy" />`).join("\n")}`;
        const descSnippet = (supabaseListing.description || "").replace(/\s+/g, " ").trim().slice(0, 140);
        description = [priceText, supabaseListing.location].filter(Boolean).join(" | ");
        if (descSnippet) description += ` - ${descSnippet}`;
        if (imgs[0]) {
          image = imgs[0];
        }

        // Product structured data -- only real fields, never invented values.
        const product: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: supabaseListing.title,
          description: (supabaseListing.description || "").replace(/\s+/g, " ").trim().slice(0, 500) || supabaseListing.title,
          url: shareUrl,
        };
        if (imgs.length) product.image = imgs;
        if (supabaseListing.brand) product.brand = { "@type": "Brand", name: supabaseListing.brand };
        if (supabaseListing.model) product.model = supabaseListing.model;
        if (hasPrice) {
          product.offers = {
            "@type": "Offer",
            url: shareUrl,
            priceCurrency: "BDT",
            price: String(supabaseListing.price),
            availability: supabaseListing.isSold ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          };
        }
        jsonLd = JSON.stringify(product).replace(/</g, "\\u003c");
      }
    }
  } catch (err) {
    console.error("share-listing lookup failed:", err);
  }

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
${removed ? '<meta name="robots" content="noindex" />\n' : ""}<link rel="canonical" href="${escapeHtml(shareUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>\n` : ""}</head>
<body>
<header><a href="${SITE_URL}/">গাড়ি বাজার</a></header>
<main>
${bodyHtml || `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>`}
<p><a href="${escapeHtml(appUrl)}">গাড়ি বাজারে বিজ্ঞাপনটি দেখুন ও বিক্রেতার সাথে যোগাযোগ করুন</a></p>
</main>
<footer><a href="${SITE_URL}/about">আমাদের সম্পর্কে</a> · <a href="${SITE_URL}/guides">গাইড</a> · <a href="${SITE_URL}/contact">যোগাযোগ</a> · <a href="${SITE_URL}/privacy-policy">গোপনীয়তা নীতি</a></footer>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(removed ? 410 : 200).send(html);
}
