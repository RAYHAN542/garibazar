// Facebook Page comment auto-reply bot (runs from GitHub Actions).
// DRY_RUN != "false" -> only logs what it would do. Never logs tokens, names or comment text.
const PAGE_ID = process.env.FB_PAGE_ID;
const SYSTEM_TOKEN = process.env.FB_SYSTEM_TOKEN;
const DRY_RUN = process.env.DRY_RUN !== "false";
const V = process.env.GRAPH_VERSION || "v25.0";
const MAX_REPLIES = Number(process.env.MAX_REPLIES || 10);
const MAX_OTHER = Number(process.env.MAX_OTHER || 4);
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 24);
const OTHER_MAX_AGE_HOURS = Number(process.env.OTHER_MAX_AGE_HOURS || 3);
const OTHER_REPLIES = true; // false = comments with no matching words are never answered
const PLAY = "https://play.google.com/store/apps/details?id=shop.garibazar.twa";

if (!PAGE_ID || !SYSTEM_TOKEN) {
  console.error("FB_PAGE_ID or FB_SYSTEM_TOKEN missing");
  process.exit(1);
}

const REPLIES = {
  price: `পোস্টের বিবরণে (description) দেওয়া নম্বরে কল করে দাম জানতে পারবেন, উনিই আসল মালিক। আরও গাড়ি দেখতে Garibazar app install করুন 👉 ${PLAY}`,
  number: `নম্বর বিবরণে (description) দেওয়া আছে। আরও গাড়ি দেখতে Garibazar app install করুন 👉 ${PLAY}`,
  sell: `গাড়ির ছবি আর বিস্তারিত (detail) ইনবক্সে পাঠান। Garibazar app install করুন, সেখানে গাড়ি বেচা-কেনা করতে পারবেন 👉 ${PLAY}`,
  other: `Garibazar app install করুন। এখানে গাড়ি ও গাড়ির পার্ট বেচা/কেনা করতে পারবেন 👉 ${PLAY}`,
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
let done = 0;
let otherDone = 0;
const stat = { own: 0, noReply: 0, old: 0, replied: 0, otherSkipped: 0 };
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
  if (kind === "other" && (!OTHER_REPLIES || ageH > OTHER_MAX_AGE_HOURS || otherDone >= MAX_OTHER)) {
    stat.otherSkipped++;
    continue;
  }
  if (DRY_RUN) {
    console.log(`WOULD reply (${kind}) to comment ${c.id}`);
  } else {
    try {
      await graph(`${c.id}/comments`, PAGE_TOKEN, { message: REPLIES[kind] }, "POST");
      console.log(`Replied (${kind}) to comment ${c.id}`);
    } catch (e) {
      console.log(`Reply failed for ${c.id}: ${e.message}`);
    }
    await sleep(2000);
  }
  kinds[kind]++;
  done++;
  if (kind === "other") otherDone++;
}
const times = comments.map((c) => new Date(c.created_time).getTime()).filter(Number.isFinite);
const newestH = times.length ? ((Date.now() - Math.max(...times)) / 3600000).toFixed(1) : "n/a";
console.log(`Filtered: ${JSON.stringify(stat)}; newest comment age (hours): ${newestH}`);
console.log(`Checked ${comments.length} comments, ${DRY_RUN ? "would reply" : "replied"}: ${done} ${JSON.stringify(kinds)}`);
