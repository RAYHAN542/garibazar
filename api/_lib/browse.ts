import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://garibazar.shop";
const PAGE_SIZE = 50;

function esc(str: unknown) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain, link-only HTML list of every active listing, split into pages of 50,
// so search-engine crawlers can reach every /l/<id> page without running JS
// or pressing "load more". Only public columns are read (no phone numbers).
export async function browseHandler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawPage = parseInt(String(req.query?.page ?? "1"), 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 1000) : 1;

  if (!supabaseUrl || !serviceKey) {
    res.status(503).setHeader("Retry-After", "600");
    return res.send("Temporarily unavailable");
  }

  let rows: any[] = [];
  let total = 0;
  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await supabase
      .from("listings")
      .select("id, title, price, location, category", { count: "exact" })
      .eq("is_deleted", false)
      .or("is_sold.is.null,is_sold.eq.false")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows = data || [];
    total = count || 0;
  } catch (e) {
    console.error("browse error:", e);
    res.status(503).setHeader("Retry-After", "600");
    return res.send("Temporarily unavailable");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) {
    res.status(404);
    return res.send("Not found");
  }

  const pageLink = (p: number) => (p === 1 ? "/browse" : `/browse?page=${p}`);
  const canonical = `${SITE_URL}${pageLink(page)}`;
  const items = rows
    .map((r) => {
      const priceText = r.price && Number(r.price) > 0 ? `৳${Number(r.price).toLocaleString("en-BD")}` : "মূল্য জানতে যোগাযোগ করুন";
      const meta = [priceText, r.location].filter(Boolean).map(esc).join(" | ");
      return `<li><a href="/l/${esc(r.id)}">${esc(r.title || "গাড়ি/পার্টস বিজ্ঞাপন")}</a><br><small>${meta}</small></li>`;
    })
    .join("\n");
  const nav = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map((p) => (p === page ? `<strong>${p}</strong>` : `<a href="${pageLink(p)}">${p}</a>`))
    .join(" ");
  const title = page === 1 ? "সব বিজ্ঞাপন - গাড়ি বাজার" : `সব বিজ্ঞাপন (পেজ ${page}) - গাড়ি বাজার`;

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="বাংলাদেশের গাড়ি, মোটরসাইকেল ও যন্ত্রাংশের সর্বশেষ বিজ্ঞাপনের তালিকা। মোট ${total}টি বিজ্ঞাপন।" />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${esc(canonical)}" />
${page > 1 ? `<link rel="prev" href="${SITE_URL}${pageLink(page - 1)}" />` : ""}
${page < totalPages ? `<link rel="next" href="${SITE_URL}${pageLink(page + 1)}" />` : ""}
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:16px;color:#0f172a;line-height:1.5}a{color:#b45309}li{margin:10px 0}nav{margin:20px 0;line-height:2}small{color:#475569}</style>
</head>
<body>
<header><a href="${SITE_URL}/">← গাড়ি বাজার</a></header>
<main>
<h1>সব বিজ্ঞাপন</h1>
<p>বাংলাদেশের গাড়ি, মোটরসাইকেল ও যন্ত্রাংশের সর্বশেষ বিজ্ঞাপন। মোট ${total}টি বিজ্ঞাপন, পেজ ${page}/${totalPages}।</p>
<ul>
${items}
</ul>
<nav aria-label="পেজ">${nav}</nav>
</main>
<footer><a href="${SITE_URL}/about">আমাদের সম্পর্কে</a> · <a href="${SITE_URL}/guides">গাইড</a> · <a href="${SITE_URL}/contact">যোগাযোগ</a> · <a href="${SITE_URL}/privacy-policy">গোপনীয়তা নীতি</a></footer>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(html);
}
