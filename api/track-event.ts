import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
    const resp = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!resp.ok) return fallback;
    const data: any = await resp.json();
    if (data?.error) return fallback;
    return {
      city: data.city || "Unknown",
      region: data.region || "",
      country: data.country_name || "",
      isp: data.org || "",
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
    const path = typeof body?.path === "string" ? body.path.slice(0, 300) : "";
    const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 300) : "";

    const ip = getClientIp(req);
    const geo = await lookupGeo(ip);
    const userAgent = (req.headers["user-agent"] || "").toString().slice(0, 300);

    const db = getFirestore();

    await db.collection("site_visits").add({
      type,
      uid,
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

    const statsField =
      type === "login" ? "totalLogins" : type === "signup" ? "totalSignups" : "totalVisits";
    await db.doc("analytics_stats/summary").set(
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
