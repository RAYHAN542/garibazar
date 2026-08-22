import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// একই IP থেকে মিনিটে ৩০ বারের বেশি রিকোয়েস্ট এলে চুপচাপ বাদ দেওয়া হয় (Firestore-এ
// লেখা হয় না), যাতে কেউ ইচ্ছাকৃতভাবে স্প্যাম করে দৈনিক write কোটা শেষ করে দিতে না পারে।
// এটা in-memory (ওয়ার্ম ইনস্ট্যান্সে টিকে থাকে), নিখুঁত না কিন্তু সহজ ও বিনামূল্যে সুরক্ষা দেয়।
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

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

const ALLOWED_TYPES = new Set(["visit", "login", "signup"]);

// The site owner's own IP(s) - visits/logins from here are excluded from the
// analytics log and totals, since they're not real customer traffic (they're
// the owner testing/checking their own site). Add more IPs here (comma
// separated) if the owner's connection changes (e.g. new home broadband,
// office wifi). Find the current IP by visiting whatismyipaddress.com.
const OWNER_IPS = new Set([
  "103.129.32.254",
]);

// Known bot / crawler / monitoring User-Agent signatures. If the UA matches
// any of these, the hit is not a real human visitor (link-preview bots like
// Facebook's, search engine crawlers, uptime monitors, scripts, etc.).
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|linkedinbot|pinterest|embedly|quora link preview|outbrain|vkshare|w3c_validator|redditbot|applebot|semrush|ahrefs|mj12bot|dotbot|baiduspider|yandex|duckduckbot|python-requests|python-urllib|curl\/|wget\/|node-fetch|axios\/|postmanruntime|headlesschrome|phantomjs|go-http-client|java\/|libwww-perl|scrapy|vercel-screenshot|vercel-favicon|^vercel|uptimerobot|pingdom|statuscake|monitor/i;

// Known hosting / cloud-provider ISPs. A "visit" from Amazon/Google/Microsoft/
// Vercel's own infrastructure is virtually always an automated request, not a
// human on a home or mobile connection.
const HOSTING_ISP_PATTERN = /amazon|aws|google llc|google cloud|microsoft corporation|azure|digitalocean|linode|ovh|hetzner|vercel inc|vercel, inc|cloudflare|oracle cloud|contabo|scaleway/i;

function isLikelyBot(userAgent: string, isp: string): boolean {
  if (!userAgent || BOT_UA_PATTERN.test(userAgent)) return true;
  if (isp && HOSTING_ISP_PATTERN.test(isp)) return true;
  return false;
}

function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

async function lookupGeo(ip: string) {
  const fallback = { city: "Unknown", region: "", country: "", isp: "" };
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return fallback;
  }
  try {
    const resp = await fetch(`https://ipwho.is/${ip}`);
    if (!resp.ok) return fallback;
    const data: any = await resp.json();
    if (data?.success === false) return fallback;
    return {
      city: data.city || "Unknown",
      region: data.region || "",
      country: data.country || "",
      isp: data.connection?.isp || data.connection?.org || "",
    };
  } catch {
    return fallback;
  }
}

// Logs a site visit / login / signup event with the visitor's real IP and
// approximate location, so the admin panel can show who is using the site
// and where they're coming from. Uses the Admin SDK (bypasses Firestore
// security rules) since the browser itself cannot see its own public IP.
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!getApps().length) {
    // Analytics is best-effort; never break the app over a missing service account.
    res.status(200).json({ ok: false });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const type = ALLOWED_TYPES.has(body?.type) ? body.type : "visit";
    const uid = typeof body?.uid === "string" ? body.uid.slice(0, 128) : null;
    const identifier = typeof body?.identifier === "string" ? body.identifier.slice(0, 128) : null;
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 300) : "";

    const ip = getClientIp(req);

    if (OWNER_IPS.has(ip)) {
      // চুপচাপ বাদ দেওয়া হচ্ছে — মালিকের নিজের ভিজিট/লগইন visitor log ও total-এ ধরা হবে না।
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    if (isRateLimited(ip)) {
      // চুপচাপ বাদ দেওয়া হচ্ছে — ইউজারকে কোনো এরর দেখানো হয় না, শুধু লগ করা হয় না।
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const geo = await lookupGeo(ip);
    const userAgent = (req.headers["user-agent"] || "").toString().slice(0, 300);

    if (isLikelyBot(userAgent, geo.isp)) {
      // Silently drop bot/crawler traffic — don't pollute the visitor log or stats.
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const db = getFirestore();

    await db.collection("site_visits").add({
      type,
      uid,
      identifier,
      ip,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      isp: geo.isp,
      userAgent,
      referrer,
      path,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Sharded counter instead of a single "analytics_stats/summary" doc.
    // A single doc has a hard Firestore write-rate ceiling (~1 write/sec
    // sustained) -- fine at today's traffic, but a real bottleneck once
    // visitor volume grows. Spreading increments across 10 shards removes
    // that ceiling almost entirely (writes land on whichever shard is picked
    // at random, so contention is divided by ~10). Reading the total sums
    // all 10 shards -- unavoidable extra reads, but reads are far cheaper
    // and less contended than writes.
    const statsField =
      type === "login" ? "totalLogins" : type === "signup" ? "totalSignups" : "totalVisits";
    const shard = Math.floor(Math.random() * 10);
    await db.doc(`analytics_stats/summary/shards/${shard}`).set(
      { [statsField]: FieldValue.increment(1) },
      { merge: true }
    );

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("track-event error:", e);
    // Never let analytics failures surface as errors to the visitor.
    res.status(200).json({ ok: false });
  }
}
