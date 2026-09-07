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

function escapeXml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Builds a fresh sitemap.xml on every request (cached at the edge for an hour)
// so newly posted listings show up for Google without a manual redeploy.
export default async function handler(req: any, res: any) {
  const staticUrls = [
    { loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0" },
    { loc: `${SITE_URL}/privacy-policy`, changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/terms`, changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/about`, changefreq: "monthly", priority: "0.5" },
    { loc: `${SITE_URL}/data-deletion`, changefreq: "monthly", priority: "0.5" },
  ];

  let listingUrls: { loc: string; changefreq: string; priority: string; lastmod?: string }[] = [];

  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("listings")
        .select("id, created_at, is_sold, is_deleted")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (!error && data) {
        listingUrls = data
          .filter((row: any) => !row.is_deleted && !row.is_sold)
          .map((row: any) => ({
            loc: `${SITE_URL}/l/${row.id}`,
            changefreq: "weekly",
            priority: "0.8",
            lastmod: row.created_at ? String(row.created_at).slice(0, 10) : undefined,
          }));
      }
    }
  } catch (e) {
    console.error("sitemap generation error:", e);
    // Fall through and still serve the static URLs so the sitemap never 500s.
  }

  const allUrls = [...staticUrls, ...listingUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${(u as any).lastmod ? `\n    <lastmod>${(u as any).lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
