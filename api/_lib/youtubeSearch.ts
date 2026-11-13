import { createClient } from "@supabase/supabase-js";
import { checkAndBumpRateLimit, getClientIp } from "./rateLimit.js";

// ------------------------------------------------------------------------
// "মেকানিক টিপস" tab: searches YouTube for how-to / repair videos.
// Called through api/account-actions.ts (action: "youtube_search") -- NOT its
// own function, because Vercel's Hobby plan allows max 12 Serverless Functions
// per deployment and the project is already at 12.
//
// Why this is a server route and not a direct call from the app:
//  - the YouTube API key stays secret (env var YOUTUBE_API_KEY, never in the app)
//  - every search is cached in Supabase (`youtube_cache`), because one
//    YouTube search.list call costs 100 quota units and the free daily quota
//    is 10,000 units (~100 searches/day). Popular searches repeat a lot, so
//    after the first person searches "ব্রেক সমস্যা", everyone else gets the
//    cached answer for free.
//  - a global daily cap + per-IP limit keep the app from burning the quota.
//
// YouTube API Services policy: cached API data must be refreshed or deleted
// within 30 days -- fresh for 7 days here, rows older than 25 days are purged.
// ------------------------------------------------------------------------

const CACHE_FRESH_MS = 7 * 24 * 60 * 60 * 1000; // serve from cache for 7 days
const CACHE_PURGE_MS = 25 * 24 * 60 * 60 * 1000; // delete rows older than 25 days (policy max is 30)
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX = 40; // searches per IP per hour (cache hits included)
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_YT_CALLS_MAX = 90; // 90 x 100 units = 9,000 of the 10,000 daily quota
const MAX_QUERY_LEN = 80;
const MAX_RESULTS = 50;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

interface TipItem {
  id: string;
  title: string;
  channel: string;
}

function decodeEntities(s: string): string {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LEN).toLowerCase();
}

export async function handleYoutubeSearch(req: any, res: any) {
  const q = normalizeQuery(req.body?.q);
  if (q.length < 2) {
    return res.status(400).json({ error: "কমপক্ষে ২ অক্ষর লিখুন।" });
  }

  const ipOk = await checkAndBumpRateLimit(`yt_search_ip_${getClientIp(req)}`, IP_WINDOW_MS, IP_MAX);
  if (!ipOk) {
    return res.status(429).json({ error: "অনেকবার সার্চ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[youtube-search] Missing Supabase env vars");
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 0) library: আগের সার্চে জমা ভিডিও আগে দেখি (YouTube ইউনিট খরচ নেই)
  let libAny: TipItem[] = [];
  try {
    const { data: libRows, error: libErr } = await supabase.rpc("tips_library_search", { p_q: q, p_limit: MAX_RESULTS });
    if (libErr) {
      console.error("[youtube-search] library read error:", libErr.message);
    } else if (Array.isArray(libRows)) {
      const toItem = (r: any): TipItem => ({ id: String(r.video_id), title: String(r.title), channel: String(r.channel || "") });
      const words = q.split(" ").filter((w) => w.length >= 2).length;
      const minScore = Math.max(1, Math.min(words, 2));
      const exact = libRows.filter((r: any) => Number(r.score) >= 1000);
      const near = libRows.filter((r: any) => Number(r.score) >= minScore);
      libAny = libRows.filter((r: any) => Number(r.score) > 0).map(toItem);
      if (exact.length >= 12) return res.status(200).json({ items: exact.slice(0, MAX_RESULTS).map(toItem), cached: true });
      if (near.length >= 15) return res.status(200).json({ items: near.slice(0, MAX_RESULTS).map(toItem), cached: true });
    }
  } catch (e: any) {
    console.error("[youtube-search] library error:", e?.message || e);
  }

  // 1) cache lookup
  let stale: TipItem[] | null = null;
  const { data: cached, error: cacheErr } = await supabase
    .from("youtube_cache")
    .select("results, created_at")
    .eq("cache_key", q)
    .maybeSingle();
  if (cacheErr) {
    console.error("[youtube-search] cache read error:", cacheErr.message);
  } else if (cached && Array.isArray((cached as any).results)) {
    const age = Date.now() - new Date((cached as any).created_at).getTime();
    if (age < CACHE_FRESH_MS) {
      return res.status(200).json({ items: (cached as any).results, cached: true });
    }
    if (age < CACHE_PURGE_MS) stale = (cached as any).results;
  }

  // 2) need a fresh YouTube call -- check key + daily cap first
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[youtube-search] YOUTUBE_API_KEY is not set");
    if (stale) return res.status(200).json({ items: stale, cached: true });
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }

  const dayOk = await checkAndBumpRateLimit("yt_search_daily_calls", DAY_MS, DAILY_YT_CALLS_MAX);
  if (!dayOk) {
    if (stale) return res.status(200).json({ items: stale, cached: true });
    if (libAny.length) return res.status(200).json({ items: libAny, cached: true });
    return res.status(429).json({ error: "আজকের নতুন সার্চের সীমা শেষ। আগের সার্চগুলো দেখুন, বা কাল আবার চেষ্টা করুন।" });
  }

  // 3) call YouTube Data API (search.list, 100 quota units)
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q,
    maxResults: String(MAX_RESULTS),
    videoEmbeddable: "true",
    videoSyndicated: "true",
    regionCode: "BD",
    relevanceLanguage: "bn",
    safeSearch: "strict",
    key: apiKey,
  });
  let ytResp: Response;
  try {
    ytResp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: any) {
    // never log the URL -- it contains the API key
    console.error("[youtube-search] YouTube request failed:", e?.name || "error");
    if (stale) return res.status(200).json({ items: stale, cached: true });
    if (libAny.length) return res.status(200).json({ items: libAny, cached: true });
    return res.status(502).json({ error: "YouTube থেকে ভিডিও আনা যায়নি। আবার চেষ্টা করুন।" });
  }

  if (!ytResp.ok) {
    console.error("[youtube-search] YouTube API status:", ytResp.status);
    if (stale) return res.status(200).json({ items: stale, cached: true });
    if (libAny.length) return res.status(200).json({ items: libAny, cached: true });
    return res.status(502).json({ error: "YouTube থেকে ভিডিও আনা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  }

  const body: any = await ytResp.json();
  const items: TipItem[] = (Array.isArray(body?.items) ? body.items : [])
    .map((it: any) => ({
      id: String(it?.id?.videoId || ""),
      title: decodeEntities(it?.snippet?.title || ""),
      channel: decodeEntities(it?.snippet?.channelTitle || ""),
    }))
    .filter((it: TipItem) => VIDEO_ID_RE.test(it.id) && it.title);

  // 4) save to cache (best effort -- a cache failure must never break the search)
  try {
    await supabase
      .from("youtube_cache")
      .upsert({ cache_key: q, results: items, created_at: new Date().toISOString() }, { onConflict: "cache_key" });
    await supabase
      .from("youtube_cache")
      .delete()
      .lt("created_at", new Date(Date.now() - CACHE_PURGE_MS).toISOString());
  } catch (e: any) {
    console.error("[youtube-search] cache write error:", e?.message || e);
  }

  // 5) নতুন ভিডিও লাইব্রেরিতে জমা (best effort)
  try {
    if (items.length) await supabase.rpc("tips_library_add", { p_q: q, p_items: items });
    await supabase.from("tips_videos").delete().lt("fetched_at", new Date(Date.now() - CACHE_PURGE_MS).toISOString());
    await supabase
      .from("tips_videos")
      .update({ description: null, description_fetched_at: null })
      .lt("description_fetched_at", new Date(Date.now() - CACHE_PURGE_MS).toISOString());
  } catch (e: any) {
    console.error("[youtube-search] library write error:", e?.message || e);
  }

  return res.status(200).json({ items, cached: false });
}


// ------------------------------------------------------------------------
// Tips video description ("বিবরণ"): fetched only when a person taps it.
// videos.list costs 1 quota unit (search.list costs 100). The text is kept in
// tips_videos.description and refreshed after 25 days (YouTube 30-day rule).
// ------------------------------------------------------------------------
const DETAILS_IP_MAX = 120; // per IP per hour
const DETAILS_DAILY_MAX = 900; // 900 units + search 9,000 stays under the 10,000 daily quota

export async function handleYoutubeDetails(req: any, res: any) {
  const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
  if (!VIDEO_ID_RE.test(id)) {
    return res.status(400).json({ error: "অবৈধ ভিডিও।" });
  }
  const ipOk = await checkAndBumpRateLimit("yt_details_ip_" + getClientIp(req), IP_WINDOW_MS, DETAILS_IP_MAX);
  if (!ipOk) {
    return res.status(429).json({ error: "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[youtube-details] Missing Supabase env vars");
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let stored = "";
  try {
    const { data, error } = await supabase.rpc("tips_library_get_description", { p_id: id });
    const row: any = Array.isArray(data) ? data[0] : data;
    if (error) {
      console.error("[youtube-details] read error:", error.message);
    } else if (row) {
      stored = typeof row.description === "string" ? row.description : "";
      if (row.fetched) return res.status(200).json({ description: stored });
    }
  } catch (e: any) {
    console.error("[youtube-details] read error:", e?.message || e);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[youtube-details] YOUTUBE_API_KEY is not set");
    if (stored) return res.status(200).json({ description: stored });
    return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
  }
  const dayOk = await checkAndBumpRateLimit("yt_details_daily_calls", DAY_MS, DETAILS_DAILY_MAX);
  if (!dayOk) {
    if (stored) return res.status(200).json({ description: stored });
    return res.status(429).json({ error: "আজকের বিবরণ আনার সীমা শেষ। কাল আবার চেষ্টা করুন।" });
  }

  const params = new URLSearchParams({ part: "snippet", id, key: apiKey });
  let ytResp: Response;
  try {
    ytResp = await fetch("https://www.googleapis.com/youtube/v3/videos?" + params.toString(), {
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: any) {
    // never log the URL -- it contains the API key
    console.error("[youtube-details] YouTube request failed:", e?.name || "error");
    if (stored) return res.status(200).json({ description: stored });
    return res.status(502).json({ error: "বিবরণ আনা যায়নি।" });
  }
  if (!ytResp.ok) {
    console.error("[youtube-details] YouTube API status:", ytResp.status);
    if (stored) return res.status(200).json({ description: stored });
    return res.status(502).json({ error: "বিবরণ আনা যায়নি।" });
  }

  const body: any = await ytResp.json();
  const description = decodeEntities(String(body?.items?.[0]?.snippet?.description || "")).slice(0, 4000);
  try {
    await supabase.rpc("tips_library_set_description", { p_id: id, p_desc: description });
  } catch (e: any) {
    console.error("[youtube-details] save error:", e?.message || e);
  }
  return res.status(200).json({ description });
}
