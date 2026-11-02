// Auto-post the newest car listings to the Facebook page (all photos of one listing per run).
const PAGE_ID = process.env.FB_PAGE_ID;
const SYSTEM_TOKEN = process.env.FB_SYSTEM_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const DRY_RUN = process.env.DRY_RUN !== "false";
const IGNORE_WINDOW = process.env.IGNORE_WINDOW === "true";
const V = process.env.GRAPH_VERSION || "v25.0";
const MAX_PER_WEEK = Number(process.env.MAX_PER_WEEK || 30);
const MAX_PER_DAY = Number(process.env.MAX_PER_DAY || 5);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 10);
const START_HOUR = Number(process.env.START_HOUR || 8); // Bangladesh time
const END_HOUR = Number(process.env.END_HOUR || 20); // exclusive
const SITE = "https://garibazar.shop";
const PLAY = "https://play.google.com/store/apps/details?id=shop.garibazar.twa";

if (!PAGE_ID || !SYSTEM_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env: FB_PAGE_ID / FB_SYSTEM_TOKEN / SUPABASE_URL / SUPABASE_KEY");
  process.exit(1);
}

const bdHour = new Date(Date.now() + 6 * 3600 * 1000).getUTCHours();
console.log(`Mode: ${DRY_RUN ? "DRY RUN (nothing is posted)" : "LIVE"}; Bangladesh hour: ${bdHour}`);
if (!IGNORE_WINDOW && (bdHour < START_HOUR || bdHour >= END_HOUR)) {
  console.log("Outside posting window (08:00-20:00 Bangladesh time), skipping.");
  process.exit(0);
}

async function graph(path, token, params = {}, method = "GET") {
  const url = new URL(`https://graph.facebook.com/${V}/${path}`);
  const init = { method };
  if (method === "GET") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", token);
  } else {
    const body = new URLSearchParams(params);
    body.set("access_token", token);
    init.body = body;
  }
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Graph ${method} ${path} failed: ${e.message || res.status} (code ${e.code}, sub ${e.error_subcode})`);
  }
  return json;
}

// 1) page token from the system-user token
const page = await graph(PAGE_ID, SYSTEM_TOKEN, { fields: "id,name,access_token" });
const PAGE_TOKEN = page.access_token;
if (!PAGE_TOKEN) {
  console.error("No page access token returned. Check gari-bot has full control of the Page.");
  process.exit(1);
}
console.log(`::add-mask::${PAGE_TOKEN}`);

// 2) what has the page already auto-posted? (a post whose text has a /l/<listing-id> link)
const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
const dayAgo = Date.now() - 24 * 3600 * 1000;
const posted = new Set();
let weekCount = 0;
let dayCount = 0;
let after;
for (let i = 0; i < 3; i++) {
  const params = { fields: "message,created_time", limit: "100" };
  if (after) params.after = after;
  const data = await graph(`${PAGE_ID}/posts`, PAGE_TOKEN, params);
  for (const p of data.data || []) {
    const m = (p.message || "").match(/গাড়ির কোড: ([0-9a-f]{8})/i);
    if (!m) continue;
    posted.add(m[1].toLowerCase());
    const t = new Date(p.created_time).getTime();
    if (t >= weekAgo) weekCount++;
    if (t >= dayAgo) dayCount++;
  }
  after = data.paging?.cursors?.after;
  if (!data.paging?.next || !after) break;
}
console.log(`Auto-posts: last 7 days ${weekCount}/${MAX_PER_WEEK}, last 24h ${dayCount}/${MAX_PER_DAY}`);
if (weekCount >= MAX_PER_WEEK || dayCount >= MAX_PER_DAY) {
  console.log("Cap reached, skipping.");
  process.exit(0);
}

// 3) newest car listings from Supabase (public read)
const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const q = new URL(`${SUPABASE_URL}/rest/v1/listings`);
q.searchParams.set("select", "id,title,description,price,location,images,is_deleted,is_sold,is_video,has_video,expires_at,created_at");
q.searchParams.set("sub_category", "eq.car");
q.searchParams.set("created_at", `gte.${since}`);
q.searchParams.set("order", "created_at.desc");
q.searchParams.set("limit", "100");
const r = await fetch(q, { headers: { apikey: SUPABASE_KEY } });
if (!r.ok) {
  console.error(`Supabase request failed: ${r.status}`);
  process.exit(1);
}
const rows = await r.json();
const now = Date.now();
const candidates = rows.filter(
  (l) =>
    !l.is_deleted &&
    !l.is_sold &&
    !l.is_video &&
    !l.has_video &&
    (!l.expires_at || new Date(l.expires_at).getTime() > now) &&
    Array.isArray(l.images) &&
    typeof l.images[0] === "string" &&
    l.images[0].startsWith("https://") &&
    !posted.has(String(l.id).slice(0, 8).toLowerCase())
);
console.log(`Car listings (7 days): ${rows.length}, eligible: ${candidates.length}`);
if (!candidates.length) {
  console.log("Nothing to post.");
  process.exit(0);
}

// 4) post the newest unposted one with ALL its own photos (max MAX_IMAGES)
const l = candidates[0];
const imgs = l.images
  .filter((u) => typeof u === "string" && u.startsWith("https://"))
  .slice(0, MAX_IMAGES);
const desc = (l.description || "").trim().slice(0, 1500);
const titleWords = l.title.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
const titleInDesc = titleWords && desc.slice(0, 200).toLowerCase().includes(titleWords);
const parts = [];
if (!titleInDesc) parts.push(`🚗 ${l.title}`);
if (desc) parts.push(desc);
if (l.location && l.location !== "Bangladesh" && !desc.includes(l.location)) parts.push("", `📍 ${l.location}`);
const caption = parts.join("\n") + `\n\n💰 দাম: আলোচনা সাপেক্ষ\n\nগাড়ির কোড: ${String(l.id).slice(0, 8)}`;

if (DRY_RUN) {
  console.log(`WOULD post listing ${l.id} with ${imgs.length} photos:\n${caption}\nimages: ${imgs.join(" , ")}`);
} else {
  const ids = [];
  for (const u of imgs) {
    try {
      const up = await graph(`${PAGE_ID}/photos`, PAGE_TOKEN, { url: u, published: "false" }, "POST");
      ids.push(up.id);
    } catch (e) {
      console.log(`Photo upload failed: ${e.message}`);
    }
  }
  if (!ids.length) {
    console.error("No photo uploaded, nothing posted.");
    process.exit(1);
  }
  const params = { message: caption };
  ids.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  const res = await graph(`${PAGE_ID}/feed`, PAGE_TOKEN, params, "POST");
  console.log(`Posted listing ${l.id} with ${ids.length} photos -> ${res.id}`);
}
