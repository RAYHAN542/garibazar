import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const SITE_URL = "https://garibazar.shop";
const DEFAULT_IMAGE = `${SITE_URL}/og-banner.jpg`;
const CRAWLER_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Pinterest|Discordbot|redditbot|Googlebot|bingbot|DuckDuckBot|Applebot|YandexBot|Baiduspider/i;

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: any, res: any) {
  const id = (req.query?.id || "").toString();
  const appUrl = id ? `${SITE_URL}/?listing=${id}` : SITE_URL;
  const shareUrl = id ? `${SITE_URL}/l/${id}` : SITE_URL;
  const userAgent = req.headers["user-agent"] || "";
  const isCrawler = CRAWLER_UA.test(userAgent);

  if (!isCrawler) {
    res.writeHead(302, { Location: appUrl });
    return res.end();
  }

  let title = "গাড়ি বাজার (Gari Bazar) - Auto Spares Marketplace";
  let description = "খুব সহজেই এবং নিরাপদে গাড়ি ও বাইকের জেনুইন স্পেয়ার পার্টস কেনা-বেচা করুন গাড়ি বাজার-এ।";
  let image = DEFAULT_IMAGE;

  try {
    if (supabaseAdmin && id) {
      const { data: listing } = await supabaseAdmin
        .from("listings")
        .select("title, brand, model, price, location, images")
        .eq("id", id)
        .maybeSingle();
      if (listing) {
        const name = listing.title || `${listing.brand || ""} ${listing.model || ""}`.trim() || "গাড়ি/পার্টস বিজ্ঞাপন";
        const priceText = listing.price ? `৳${Number(listing.price).toLocaleString("en-BD")}` : "মূল্য জানতে যোগাযোগ করুন";
        title = `${name} - গাড়ি বাজার`;
        description = [priceText, listing.location].filter(Boolean).join(" | ");
        if (Array.isArray(listing.images) && listing.images[0]) {
          image = listing.images[0];
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
