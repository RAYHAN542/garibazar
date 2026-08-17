import os

changed_parts = []

path = "api/track-event.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# --- 1) Add OWNER_IPS constant ---
old_const = '''const ALLOWED_TYPES = new Set(["visit", "login", "signup"]);

// Known bot / crawler / monitoring User-Agent signatures. If the UA matches
// any of these, the hit is not a real human visitor (link-preview bots like
// Facebook's, search engine crawlers, uptime monitors, scripts, etc.).
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|linkedinbot|pinterest|embedly|quora link preview|outbrain|vkshare|w3c_validator|redditbot|applebot|semrush|ahrefs|mj12bot|dotbot|baiduspider|yandex|duckduckbot|python-requests|python-urllib|curl\\/|wget\\/|node-fetch|axios\\/|postmanruntime|headlesschrome|phantomjs|go-http-client|java\\/|libwww-perl|scrapy|vercel-screenshot|vercel-favicon|^vercel|uptimerobot|pingdom|statuscake|monitor/i;

// Known hosting / cloud-provider ISPs. A "visit" from Amazon/Google/Microsoft/
// Vercel's own infrastructure is virtually always an automated request, not a
// human on a home or mobile connection.
const HOSTING_ISP_PATTERN = /amazon|aws|google llc|google cloud|microsoft corporation|azure|digitalocean|linode|ovh|hetzner|vercel inc|vercel, inc|cloudflare|oracle cloud|contabo|scaleway/i;'''

new_const = '''const ALLOWED_TYPES = new Set(["visit", "login", "signup"]);

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
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|linkedinbot|pinterest|embedly|quora link preview|outbrain|vkshare|w3c_validator|redditbot|applebot|semrush|ahrefs|mj12bot|dotbot|baiduspider|yandex|duckduckbot|python-requests|python-urllib|curl\\/|wget\\/|node-fetch|axios\\/|postmanruntime|headlesschrome|phantomjs|go-http-client|java\\/|libwww-perl|scrapy|vercel-screenshot|vercel-favicon|^vercel|uptimerobot|pingdom|statuscake|monitor/i;

// Known hosting / cloud-provider ISPs. A "visit" from Amazon/Google/Microsoft/
// Vercel's own infrastructure is virtually always an automated request, not a
// human on a home or mobile connection.
const HOSTING_ISP_PATTERN = /amazon|aws|google llc|google cloud|microsoft corporation|azure|digitalocean|linode|ovh|hetzner|vercel inc|vercel, inc|cloudflare|oracle cloud|contabo|scaleway/i;'''

if "OWNER_IPS" in content:
    changed_parts.append("const-already-present")
elif old_const in content:
    content = content.replace(old_const, new_const, 1)
    changed_parts.append("const-added")
else:
    print("[WARN] expected constants block not found in api/track-event.ts — check manually")

# --- 2) Skip logging when ip is in OWNER_IPS ---
old_skip = '''    const ip = getClientIp(req);

    if (isRateLimited(ip)) {'''

new_skip = '''    const ip = getClientIp(req);

    if (OWNER_IPS.has(ip)) {
      // চুপচাপ বাদ দেওয়া হচ্ছে — মালিকের নিজের ভিজিট/লগইন visitor log ও total-এ ধরা হবে না।
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    if (isRateLimited(ip)) {'''

if "OWNER_IPS.has(ip)" in content:
    changed_parts.append("skip-already-present")
elif old_skip in content:
    content = content.replace(old_skip, new_skip, 1)
    changed_parts.append("skip-added")
else:
    print("[WARN] expected rate-limit block not found in api/track-event.ts — check manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_exclude_owner_ip_analytics.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

ok_fresh = {"const-added", "skip-added"}
ok_rerun = {"const-already-present", "skip-already-present"}
got = set(changed_parts)

if ok_fresh.issubset(got) or ok_rerun.issubset(got):
    print("[OK] এখন থেকে 103.129.32.254 থেকে ভিজিট/লগইন Visitor log ও Total Visits/Logins-এ যোগ হবে না।")
    print("নোট: আগে থেকে লগ হওয়া পুরনো এন্ট্রিগুলো এমনিতেই থেকে যাবে (মুছবে না) — শুধু নতুন থেকে বন্ধ হবে।")
else:
    print(f"[PARTIAL] চেক করুন: {(ok_fresh - got)}")
