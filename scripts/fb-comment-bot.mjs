// Facebook Page comment auto-reply bot (runs from GitHub Actions).
// DRY_RUN != "false" -> only logs. Never logs tokens, names or comment text.
const PAGE_ID = process.env.FB_PAGE_ID;
const SYSTEM_TOKEN = process.env.FB_SYSTEM_TOKEN;
const DRY_RUN = process.env.DRY_RUN !== "false";
const V = process.env.GRAPH_VERSION || "v25.0";
const MAX_REPLIES = Number(process.env.MAX_REPLIES || 10);
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 24);
const PLAY = "https://play.google.com/store/apps/details?id=shop.garibazar.twa";

if (!PAGE_ID || !SYSTEM_TOKEN) {
  console.error("FB_PAGE_ID or FB_SYSTEM_TOKEN missing");
  process.exit(1);
}

const REPLIES = {
  price: `পোস্টের বিবরণে (description) দেওয়া নম্বরে কল করে দাম জানতে পারবেন, উনিই আসল মালিক। আরও গাড়ি দেখতে Garibazar app install করুন 👉 ${PLAY}`,
  number: `নম্বর বিবরণে (description) দেওয়া আছে। আরও গাড়ি দেখতে Garibazar app install করুন 👉 ${PLAY}`,
  sell: `গাড়ির ছবি আর বিস্তারিত (detail) ইনবক্সে পাঠান। Garibazar app install করুন, সেখানে গাড়ি বেচা-কেনা করতে পারবেন 👉 ${PLAY}`,
  other: `Garibazar app install করুন। সেখানে গাড়ি ও গাড়ির পার্ট বেচা/কেনা করতে পারবেন 👉 ${PLAY}`,
};

const SELL_RE = [
  /(বিক্রি|বিক্রী|বিক্রয়)\s*(করব(?!েন)|করবো|করতে\s*চাই|করতে\s*চাচ্ছি|করে\s*দেন|করে\s*দিন)/,
  /(বেচব|বেচবো|বেচতে\s*চাই|বেচে\s*দেন|বেচে\s*দিন)/,
  /(want to sell|wanna sell|sell my|bikri\s*(korbo|korte chai|kore den))/,
];
const PRICE_WORDS = ["দাম", "প্রাইস", "price", "মূল্য", "কত", "dam koto"];
const NUMBER_WORDS = ["নাম্বার", "নম্বর", "নাম্বর", "number", "মোবাইল", "mobile", "ফোন", "phone",
  "যোগাযোগ", "যোগাজোগ", "jogajog", "jugajog", "jugajok", "jogajok", "contact", "whatsapp", "হোয়াটসঅ্যাপ"];

function classify(msg) {
  const t = (msg || "").normalize("NFC").toLowerCase();
  if (SELL_RE.some((re) => re.test(t))) return "sell";
  if (PRICE_WORDS.some((k) => t.includes(k))) return "price";
  if (NUMBER_WORDS.some((k) => t.includes(k))) return "number";
  return "other";
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

// 2) collect recent comments: list posts, then read each post's newest comments
const COMMENT_FIELDS = "id,message,created_time,can_comment,from{id},comments.limit(10){id,message,from{id}}";
const DEEP = true; // deep scan on every run
const LIGHT_N = 12;
const DEEP_N = 60;
const seen = new Set();
const comments = [];
const errors = [];
const SOURCES = [
  { name: "feed" },
  { name: "videos" },
  { name: "video_reels" },
  { name: "ads_posts", extra: { include_inline_create: "true" } },
];

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

async function newestComments(postId) {
  const base = { fields: COMMENT_FIELDS, limit: "30", filter: "toplevel" };
  try {
    return (await graph(`${postId}/comments`, PAGE_TOKEN, { ...base, order: "reverse_chronological" })).data || [];
  } catch (e) {
    try {
      return (await graph(`${postId}/comments`, PAGE_TOKEN, base)).data || [];
    } catch (e2) {
      errors.push(e2.message.slice(0, 140));
      return [];
    }
  }
}

for (const { name: source, extra } of SOURCES) {
  try {
    const list = await graph(`${PAGE_ID}/${source}`, PAGE_TOKEN, { fields: "id", limit: String(DEEP ? DEEP_N : LIGHT_N), ...(extra || {}) });
    const ids = (list.data || []).map((x) => x.id);
    const lists = await pool(ids, 8, newestComments);
    let n = 0;
    for (const arr of lists) {
      for (const c of arr || []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        comments.push(c);
        n++;
      }
    }
    console.log(`${source}: ${ids.length} posts${DEEP ? " (deep scan)" : ""}, ${n} comments`);
  } catch (e) {
    console.log(`${source}: skipped (${e.message})`);
  }
}
if (errors.length) console.log(`comment fetch errors: ${errors.length}, first: ${errors[0]}`);
comments.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

// 3) reply to everything that has no page reply yet
let done = 0;
const stat = { own: 0, noReply: 0, old: 0, replied: 0 };
const kinds = { price: 0, number: 0, sell: 0, other: 0 };
for (const c of comments) {
  if (done >= MAX_REPLIES) break;
  if (c.from?.id === PAGE_ID) { stat.own++; continue; }
  if (c.can_comment === false) { stat.noReply++; continue; }
  const ageH = (Date.now() - new Date(c.created_time).getTime()) / 3600000;
  if (ageH > MAX_AGE_HOURS) { stat.old++; continue; }
  const replied = (c.comments?.data || []).some(
    (r) => r.from?.id === PAGE_ID || /garibazar/i.test(r.message || "")
  );
  if (replied) { stat.replied++; continue; }
  const kind = classify(c.message);
  if (DRY_RUN) {
    console.log(`WOULD reply (${kind}) to comment ${c.id}`);
  } else {
    try {
      await graph(`${c.id}/comments`, PAGE_TOKEN, { message: REPLIES[kind] }, "POST");
      console.log(`Replied (${kind}) to comment ${c.id}`);
    } catch (e) {
      console.log(`Reply failed for ${c.id}: ${e.message}`);
    }
    await sleep(3000);
  }
  kinds[kind]++;
  done++;
}
const times = comments.map((c) => new Date(c.created_time).getTime()).filter(Number.isFinite);
const newestH = times.length ? ((Date.now() - Math.max(...times)) / 3600000).toFixed(1) : "n/a";
console.log(`Filtered: ${JSON.stringify(stat)}; newest comment age (hours): ${newestH}`);
console.log(`Checked ${comments.length} comments, ${DRY_RUN ? "would reply" : "replied"}: ${done} ${JSON.stringify(kinds)}`);
