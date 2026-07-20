import os

changes = 0

# =====================================================================
# 1. NEW FILE: api/track-event.ts (serverless function)
# =====================================================================
track_event_api_path = "api/track-event.ts"
track_event_api_content = '''import { initializeApp, getApps, cert } from "firebase-admin/app";
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
'''

if os.path.exists(track_event_api_path):
    print(f"[SKIP] {track_event_api_path} already exists -- not overwriting. Check manually.")
else:
    os.makedirs(os.path.dirname(track_event_api_path), exist_ok=True)
    with open(track_event_api_path, "w", encoding="utf-8") as f:
        f.write(track_event_api_content)
    changes += 1
    print(f"[OK] Created {track_event_api_path}")

# =====================================================================
# 2. NEW FILE: src/utils/trackEvent.ts (client helper)
# =====================================================================
track_event_util_path = "src/utils/trackEvent.ts"
track_event_util_content = '''// Fire-and-forget visitor/login/signup analytics. This never blocks or
// throws -- if it fails for any reason (offline, ad-blocker, slow network)
// the app keeps working normally. `keepalive: true` lets the request finish
// even if the page navigates away right after this is called.
export function trackEvent(type: "visit" | "login" | "signup", uid?: string | null) {
  try {
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        uid: uid || null,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || "",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore -- analytics should never break the app
  }
}
'''

if os.path.exists(track_event_util_path):
    print(f"[SKIP] {track_event_util_path} already exists -- not overwriting. Check manually.")
else:
    os.makedirs(os.path.dirname(track_event_util_path), exist_ok=True)
    with open(track_event_util_path, "w", encoding="utf-8") as f:
        f.write(track_event_util_content)
    changes += 1
    print(f"[OK] Created {track_event_util_path}")

# =====================================================================
# 3. src/App.tsx -- import + session-guarded visit tracking effect
# =====================================================================
app_path = "src/App.tsx"
with open(app_path, "r", encoding="utf-8") as f:
    app_content = f.read()

old = 'import { logger } from "./utils/logger";'
new = 'import { logger } from "./utils/logger";\nimport { trackEvent } from "./utils/trackEvent";'
if old in app_content and "./utils/trackEvent" not in app_content.split(old)[0]:
    app_content = app_content.replace(old, new, 1)
    changes += 1
    print("[OK] App.tsx: added trackEvent import")
else:
    print("[SKIP] App.tsx: import pattern not found or already present")

old = '''
  // Open a specific listing when arriving via a shared link (?listing=<id>)'''
new = '''
  // Track a site visit once per browser session (not once per page load --
  // opening/closing a listing now does a real reload, and we don't want that
  // to inflate visit counts). Anonymous, IP-based, feeds the admin panel's
  // "Visitors & Logins" tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!sessionStorage.getItem("gari_bazar_visit_tracked")) {
        sessionStorage.setItem("gari_bazar_visit_tracked", "1");
        trackEvent("visit");
      }
    } catch {
      trackEvent("visit");
    }
  }, []);

  // Open a specific listing when arriving via a shared link (?listing=<id>)'''
if old in app_content:
    app_content = app_content.replace(old, new, 1)
    changes += 1
    print("[OK] App.tsx: added session-guarded visit-tracking effect")
else:
    print("[SKIP] App.tsx: deep-link effect anchor not found -- check manually")

with open(app_path, "w", encoding="utf-8") as f:
    f.write(app_content)

# =====================================================================
# 4. src/components/AuthModal.tsx -- import + login/signup tracking
# =====================================================================
auth_path = "src/components/AuthModal.tsx"
with open(auth_path, "r", encoding="utf-8") as f:
    auth_content = f.read()

old = '''import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";
import { uploadToCloudinary } from "../utils/cloudinary";'''
new = '''import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";
import { uploadToCloudinary } from "../utils/cloudinary";
import { trackEvent } from "../utils/trackEvent";'''
if old in auth_content:
    auth_content = auth_content.replace(old, new, 1)
    changes += 1
    print("[OK] AuthModal.tsx: added trackEvent import")
else:
    print("[SKIP] AuthModal.tsx: import pattern not found")

old = '''      localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
      onAuthSuccess(sessionUser);'''
new = '''      localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
      trackEvent("login", fbUser.uid);
      onAuthSuccess(sessionUser);'''
if old in auth_content:
    auth_content = auth_content.replace(old, new, 1)
    changes += 1
    print("[OK] AuthModal.tsx: added login tracking (returning users)")
else:
    print("[SKIP] AuthModal.tsx: login pattern not found")

old = '''      await setDoc(doc(db, "users", googleUser.uid), savedData);
      localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
      onAuthSuccess(savedData);'''
new = '''      await setDoc(doc(db, "users", googleUser.uid), savedData);
      localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
      trackEvent("signup", googleUser.uid);
      onAuthSuccess(savedData);'''
if old in auth_content:
    auth_content = auth_content.replace(old, new, 1)
    changes += 1
    print("[OK] AuthModal.tsx: added signup tracking (new users)")
else:
    print("[SKIP] AuthModal.tsx: signup pattern not found")

with open(auth_path, "w", encoding="utf-8") as f:
    f.write(auth_content)

# =====================================================================
# 5. src/components/AdminPanel.tsx -- imports, state, effects, tab, UI
# =====================================================================
admin_path = "src/components/AdminPanel.tsx"
with open(admin_path, "r", encoding="utf-8") as f:
    admin_content = f.read()

old = '''import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc 
} from "firebase/firestore";'''
new = '''import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  limit
} from "firebase/firestore";'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added 'limit' import")
else:
    print("[SKIP] AdminPanel.tsx: firestore import pattern not found")

old = '''import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  Loader2, 
  Save, 
  Check, 
  Phone, 
  Smartphone, 
  ArrowRight, 
  User, 
  Clock, 
  Mail,
  Trash2,
  Search,
  TrendingUp,
  Grid,
  Inbox,
  Flag
} from "lucide-react";'''
new = '''import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  Loader2, 
  Save, 
  Check, 
  Phone, 
  Smartphone, 
  ArrowRight, 
  User, 
  Clock, 
  Mail,
  Trash2,
  Search,
  TrendingUp,
  Grid,
  Inbox,
  Flag,
  Activity,
  Globe,
  Users,
  MapPin
} from "lucide-react";'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added Activity/Globe/Users/MapPin icons")
else:
    print("[SKIP] AdminPanel.tsx: lucide-react import pattern not found")

old = '''  // Sub-tabs for the Admin Panel itself to make it exceptionally organized and professional
  const [adminSubTab, setAdminSubTab] = useState<"requests" | "listings" | "settings" | "tickets">("requests");'''
new = '''  // Sub-tabs for the Admin Panel itself to make it exceptionally organized and professional
  const [adminSubTab, setAdminSubTab] = useState<"requests" | "listings" | "settings" | "tickets" | "analytics">("requests");

  // Visitor / login / signup analytics states
  const [visitEvents, setVisitEvents] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [analyticsStats, setAnalyticsStats] = useState<{ totalVisits?: number; totalLogins?: number; totalSignups?: number }>({});'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added analytics state")
else:
    print("[SKIP] AdminPanel.tsx: adminSubTab state pattern not found")

old = '''    return () => unsubscribe();
  }, []);

  const handleResolveTicket = async (ticketId: string) => {'''
new = '''    return () => unsubscribe();
  }, []);

  // Live summary counters -- total visits / logins / signups (one small doc,
  // kept up to date atomically by the /api/track-event serverless function).
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "analytics_stats", "summary"), (docSnap) => {
      setAnalyticsStats(docSnap.exists() ? (docSnap.data() as any) : {});
    }, (err) => {
      console.error("Could not fetch analytics summary:", err);
    });
    return () => unsub();
  }, []);

  // Recent visit/login/signup log, most recent first.
  useEffect(() => {
    const q = query(
      collection(db, "site_visits"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setVisitEvents(list);
      setLoadingVisits(false);
    }, (err) => {
      console.error("Could not fetch site visits:", err);
      setLoadingVisits(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolveTicket = async (ticketId: string) => {'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added analytics data-fetching effects")
else:
    print("[SKIP] AdminPanel.tsx: tickets-effect anchor not found")

old = '''          {language === "bn"
            ? `সাপোর্ট টিকেট (${ticketsList.filter(t => t.status !== "resolved").length})`
            : `Support Tickets (${ticketsList.filter(t => t.status !== "resolved").length})`}
        </button>
      </div>'''
new = '''          {language === "bn"
            ? `সাপোর্ট টিকেট (${ticketsList.filter(t => t.status !== "resolved").length})`
            : `Support Tickets (${ticketsList.filter(t => t.status !== "resolved").length})`}
        </button>

        <button
          onClick={() => setAdminSubTab("analytics")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            adminSubTab === "analytics"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? "ভিজিটর ও লগইন" : "Visitors & Logins"}
        </button>
      </div>'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added 'Visitors & Logins' tab button")
else:
    print("[SKIP] AdminPanel.tsx: tab-button anchor not found")

old = '''              ))}
            </div>
          )}
        </div>

      ) : (

        /* 2. REFILL PENDING LISTINGS CONTROL PANEL */'''
new = '''              ))}
            </div>
          )}
        </div>

      ) : adminSubTab === "analytics" ? (

        /* VISITOR / LOGIN / SIGNUP ANALYTICS PANEL */
        <div className="space-y-4">
          <h5 className="text-sm font-black text-slate-850 dark:text-white mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            {language === "bn" ? "ভিজিটর ও লগইন পরিসংখ্যান" : "Visitor & Login Analytics"}
          </h5>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <Globe className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-850 dark:text-white">{(analyticsStats.totalVisits || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">{language === "bn" ? "মোট ভিজিট" : "Total Visits"}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <User className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-850 dark:text-white">{(analyticsStats.totalLogins || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">{language === "bn" ? "মোট লগইন" : "Total Logins"}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <Users className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-black text-slate-850 dark:text-white">{(analyticsStats.totalSignups || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase">{language === "bn" ? "নতুন ইউজার" : "New Signups"}</p>
            </div>
          </div>

          <h6 className="text-xs font-black text-slate-500 uppercase tracking-wider pt-2">
            {language === "bn" ? "সাম্প্রতিক ভিজিট লগ" : "Recent Visit Log"}
          </h6>

          {loadingVisits ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            </div>
          ) : visitEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-bold text-slate-500">
                {language === "bn" ? "এখনো কোনো ভিজিট রেকর্ড হয়নি।" : "No visits recorded yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visitEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span
                      className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full ${
                        ev.type === "signup"
                          ? "bg-amber-500/15 text-amber-500"
                          : ev.type === "login"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-blue-500/15 text-blue-500"
                      }`}
                    >
                      {ev.type === "signup"
                        ? (language === "bn" ? "নতুন ইউজার" : "Signup")
                        : ev.type === "login"
                        ? (language === "bn" ? "লগইন" : "Login")
                        : (language === "bn" ? "ভিজিট" : "Visit")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {ev.city || "Unknown"}{ev.country ? `, ${ev.country}` : ""}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{ev.ip || "-"}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">
                    {ev.createdAt?.toDate
                      ? ev.createdAt.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (

        /* 2. REFILL PENDING LISTINGS CONTROL PANEL */'''
if old in admin_content:
    admin_content = admin_content.replace(old, new, 1)
    changes += 1
    print("[OK] AdminPanel.tsx: added 'Visitors & Logins' tab content")
else:
    print("[SKIP] AdminPanel.tsx: tickets-to-requests boundary not found")

with open(admin_path, "w", encoding="utf-8") as f:
    f.write(admin_content)

# =====================================================================
# 6. firestore.rules -- lock down the new collections to admin-read-only
# =====================================================================
rules_path = "firestore.rules"
with open(rules_path, "r", encoding="utf-8") as f:
    rules_content = f.read()

old = '''    // ---------- SUPPORT TICKETS (guests can also submit) ----------
    match /support_tickets/{ticketId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if (isSignedIn() && request.resource.data.userId == request.auth.uid) ||
                    (!isSignedIn() && request.resource.data.userId == "guest");
      allow update, delete: if isAdmin();
    }

    // ---------- Everything else: locked down ----------'''
new = '''    // ---------- SUPPORT TICKETS (guests can also submit) ----------
    match /support_tickets/{ticketId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if (isSignedIn() && request.resource.data.userId == request.auth.uid) ||
                    (!isSignedIn() && request.resource.data.userId == "guest");
      allow update, delete: if isAdmin();
    }

    // ---------- SITE VISIT / LOGIN / SIGNUP ANALYTICS ----------
    // Written only by the /api/track-event serverless function (Admin SDK),
    // which bypasses these rules -- keeps visitor IP/location data from
    // being writable or readable by anyone except an admin.
    match /site_visits/{visitId} {
      allow read: if isAdmin();
      allow write: if false;
    }
    match /analytics_stats/{statId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // ---------- Everything else: locked down ----------'''
if old in rules_content:
    rules_content = rules_content.replace(old, new, 1)
    changes += 1
    print("[OK] firestore.rules: added site_visits / analytics_stats rules")
else:
    print("[SKIP] firestore.rules: anchor not found -- check manually")

with open(rules_path, "w", encoding="utf-8") as f:
    f.write(rules_content)

print(f"\n[DONE] Applied {changes}/14 change(s).")
print("       IMPORTANT: also run 'firebase deploy --only firestore:rules'")
print("       (or push the rules through the Firebase console) so the new")
print("       collections are actually protected -- git push alone does NOT")
print("       deploy Firestore rules.")
