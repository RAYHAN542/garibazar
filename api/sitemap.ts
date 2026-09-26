import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://garibazar.shop";

function escapeXml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 🔧 (2026-09-26) Migrated off Firestore -- listings have lived in Supabase's
// `listings` table since the migration (see src/utils/listingsApi.ts), so
// the old db.collection("listings") query here always came back empty for
// anything posted after that point: every new listing has been silently
// missing from sitemap.xml since then, so Google was never seeing them.
// Now reads the same table the rest of the app already reads from.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // is_sold can be null on older rows (never explicitly set) as well as
      // false -- .eq("is_sold", false) alone would silently exclude every
      // null row too (SQL: NULL = false is NULL, not true), so match both.
      const { data, error } = await supabase
        .from("listings")
        .select("id, created_at")
        .eq("is_deleted", false)
        .or("is_sold.is.null,is_sold.eq.false")
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      listingUrls = (data || []).map((row: any) => {
        let lastmod: string | undefined;
        try {
          if (row.created_at) lastmod = new Date(row.created_at).toISOString().slice(0, 10);
        } catch {
          // ignore
        }
        return {
          loc: `${SITE_URL}/l/${row.id}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod,
        };
      });
    } else {
      console.error("[sitemap] Missing Supabase env vars -- serving static URLs only.");
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
