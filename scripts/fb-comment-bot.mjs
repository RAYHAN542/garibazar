// Facebook Page comment auto-reply bot (runs from GitHub Actions).
// DRY_RUN != "false" -> only logs what it would do. Never logs tokens, names or comment text.
const PAGE_ID = process.env.FB_PAGE_ID;
const SYSTEM_TOKEN = process.env.FB_SYSTEM_TOKEN;
const DRY_RUN = process.env.DRY_RUN !== "false";
const V = process.env.GRAPH_VERSION || "v25.0";
const MAX_REPLIES = Number(process.env.MAX_REPLIES || 10);
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 72);
const PLAY = "https://play.google.com/store/apps/details?id=shop.garibazar.twa";

if (!PAGE_ID || !SYSTEM_TOKEN) {
  console.error("FB_PAGE_ID or FB_SYSTEM_TOKEN missing");
  process.exit(1);
}

const KEYWORDS = ["দাম", "প্রাইস", "price", "কত", "নাম্বার", "নম্বর", "number", "মোবাইল",
  "mobile", "ফোন", "phone", "লিংক", "link", "যোগাযোগ", "contact", "কল"];
const TEMPLATES = [
  `ধন্যবাদ! দাম, ছবি ও বিক্রেতার মোবাইল নম্বর সব পাবেন গাড়ি বাজার অ্যাপে। 📲 ডাউনলোড: ${PLAY}`,
  `আপনার আগ্রহের জন্য ধন্যবাদ। দাম ও বিক্রেতার নম্বর দেখতে গাড়ি বাজার অ্যাপটি নিন 👉 ${PLAY} (অথবা garibazar.shop)`,
  `বিস্তারিত তথ্য, দাম ও যোগাযোগের নম্বর গাড়ি বাজার অ্যাপেই আছে। এখান থেকে নিন: ${PLAY}`,
];

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

const wantsReply = (msg) => {
  const t = (msg || "").normalize("NFC").toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) page token from the system-user token
const page = await graph(PAGE_ID, SYSTEM_TOKEN, { fields: "id,name,access_token" });
const PAGE_TOKEN = page.access_token;
if (!PAGE_TOKEN) {
  console.error("No page access token returned. Check gari-bot has full control of the Page.");
  process.exit(1);
}
console.log(`::add-mask::${PAGE_TOKEN}`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN (nothing is posted)" : "LIVE"}`);

// 2) collect recent comments
const FIELDS =
  "id,created_time,comments.limit(50){id,message,created_time,can_comment,from{id},comments.limit(10){id,message,from{id}}}";
const seen = new Set();
const comments = [];
for (const source of ["feed", "videos", "video_reels"]) {
  try {
    const data = await graph(`${PAGE_ID}/${source}`, PAGE_TOKEN, { fields: FIELDS, limit: "15" });
    let n = 0;
    for (const post of data.data || []) {
      for (const c of post.comments?.data || []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        comments.push(c);
        n++;
      }
    }
    console.log(`${source}: ${(data.data || []).length} items, ${n} comments`);
  } catch (e) {
    console.log(`${source}: skipped (${e.message})`);
  }
}

// 3) decide and reply
const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
let done = 0;
for (const c of comments) {
  if (done >= MAX_REPLIES) break;
  if (c.from?.id === PAGE_ID) continue;
  if (c.can_comment === false) continue;
  if (new Date(c.created_time).getTime() < cutoff) continue;
  if (!wantsReply(c.message)) continue;
  const replied = (c.comments?.data || []).some(
    (r) => r.from?.id === PAGE_ID || /garibazar/i.test(r.message || "")
  );
  if (replied) continue;
  const idx = [...c.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TEMPLATES.length;
  if (DRY_RUN) {
    console.log(`WOULD reply to comment ${c.id} (template ${idx + 1})`);
  } else {
    try {
      await graph(`${c.id}/comments`, PAGE_TOKEN, { message: TEMPLATES[idx] }, "POST");
      console.log(`Replied to comment ${c.id}`);
    } catch (e) {
      console.log(`Reply failed for ${c.id}: ${e.message}`);
    }
    await sleep(2000);
  }
  done++;
}
console.log(`Checked ${comments.length} comments, ${DRY_RUN ? "would reply" : "replied"}: ${done}`);
