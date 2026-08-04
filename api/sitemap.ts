import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

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
    { loc: `${SITE_URL}/data-deletion`, changefreq: "monthly", priority: "0.5" },
  ];

  let listingUrls: { loc: string; changefreq: string; priority: string; lastmod?: string }[] = [];

  try {
    if (getApps().length) {
      const db = getFirestore();
      const snap = await db
        .collection("listings")
        .orderBy("createdAt", "desc")
        .limit(5000)
        .get();

      listingUrls = snap.docs
        .filter((doc) => {
          const d = doc.data() as any;
          return d.status !== "deleted" && d.status !== "sold" && d.status !== "removed";
        })
        .map((doc) => {
          const d = doc.data() as any;
          let lastmod: string | undefined;
          try {
            if (d.createdAt?.toDate) lastmod = d.createdAt.toDate().toISOString().slice(0, 10);
          } catch {
            // ignore
          }
          return {
            loc: `${SITE_URL}/l/${doc.id}`,
            changefreq: "weekly",
            priority: "0.8",
            lastmod,
          };
        });
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
