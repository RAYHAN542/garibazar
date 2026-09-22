import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from "firebase/app-check";
import { Capacitor } from "@capacitor/core";
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";
import { logger } from "./utils/logger";
import { apiUrl } from "./utils/apiBase";

const requiredEnv = (key: string, value: string | undefined): string => {
  if (!value) {
    console.error(`[Firebase] Missing env variable: ${key}. Set it in .env (local) or Vercel Project Settings (production).`);
  }
  return value ?? "";
};

const firebaseConfig = {
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY", import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID", import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: requiredEnv("VITE_FIREBASE_STORAGE_BUCKET", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: requiredEnv("VITE_FIREBASE_APP_ID", import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: requiredEnv("VITE_FIREBASE_MEASUREMENT_ID", import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const app = initializeApp(firebaseConfig);

// App Check: proves to Firebase that requests are coming from our real
// website, not a bot/script calling the API directly. reCAPTCHA v3 runs
// completely invisibly in the background -- no checkbox, no image puzzle,
// users never see or do anything extra.
//
// IMPORTANT: App Check enforcement is now ON (Firestore, since Aug 26) --
// so this must initialize immediately, not deferred. A deferred/idle-time
// init left a multi-second window right after page load where Firestore
// writes had no token yet and got rejected with permission-denied.
//
// Inside the packaged Android app (Capacitor), this WebView can't run
// reCAPTCHA v3 reliably -- it's built for real browsers, not embedded
// WebViews. So on native, we use Play Integrity instead: the native layer
// (registered in Firebase Console -> App Check -> Apps -> GariBazar
// Android) attests the token, and this CustomProvider just relays it to
// the same web Firestore SDK the site already uses.
// আগে এখানে native (Capacitor) app-এর জন্য Play Integrity দিয়ে App Check
// চালু করার চেষ্টা হতো। কিন্তু এই APK এখনো Play Store দিয়ে ইনস্টল করা না
// (sideload/Test Lab দিয়ে) -- তাই Google-এর Play Integrity attestation
// প্রতিবারই 403 "App attestation failed" দিয়ে ব্যর্থ হয় (Firebase Test
// Lab-এর logcat-এ নিশ্চিত করা হয়েছে)। এই ব্যর্থতার পেছনে token-fetch
// retry loop চলতে থাকে, আর তার আড়ালে আসল Firestore রিকোয়েস্টই কখনো
// পাঠানো হয় না -- listings চিরকাল "loading" স্কেলিটনে আটকে থাকে।
//
// audit C13 ফিক্স: getToken() এখন কখনো reject করে না (timeout/error হলেও
// resolve করে খালি token দিয়ে) -- এটাই আসল কারণ ছিল রিট্রাই-লুপ আটকে
// থাকার, reject করলেই Firebase SDK নিজে থেকে backoff করে বারবার চেষ্টা
// করতে থাকে, আর সেই সময়টায় আসল Firestore রিকোয়েস্ট পাঠানোই হয় না।
// এখন resolve করায় রিকোয়েস্ট সাথে সাথে যায়; enforcement এখনো "Monitoring"
// (নিচের কমেন্ট দ্রষ্টব্য) তাই খালি/ভুল token থাকলেও সার্ভার শুধু লগ করে,
// রিকোয়েস্ট আটকায় না।
//
// এই পুরো ব্লকটা env flag VITE_APPCHECK_NATIVE=1 না থাকলে ডিফল্টভাবে বন্ধই
// থাকে (আগের নিরাপদ আচরণ অপরিবর্তিত) -- Play Store internal testing-এ
// আপলোড করে, Firebase Console -> App Check -> Apps-এ upload-cert SHA-256
// রেজিস্টার করার পরই এই ফ্ল্যাগ অন করা উচিত, তার আগে না (এখনো করলে Play
// Integrity attestation ফেইল করবেই যেহেতু cert রেজিস্টার্ড না)।
//
// Firestore-এ App Check enforcement এখনো "Monitoring" মোডে (Enforced না)।
async function getNativeAppCheckToken(): Promise<{ token: string; expireTimeMillis: number }> {
  const TIMEOUT_MS = 3000;
  try {
    const result = await Promise.race([
      FirebaseAppCheck.getToken(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("App Check native token fetch timed out")), TIMEOUT_MS)
      ),
    ]);
    // Firebase's own getToken() doesn't return an expiry from the native
    // plugin, so give it a short, safe lifetime and let the SDK re-call
    // getToken() to refresh rather than trust a token for longer than we
    // actually know it's valid.
    return { token: result.token, expireTimeMillis: Date.now() + 30 * 60 * 1000 };
  } catch (err) {
    logger.debug("Native App Check token fetch failed/timed out -- resolving with an empty token so Firestore reads aren't blocked:", err);
    return { token: "", expireTimeMillis: Date.now() + 60 * 1000 };
  }
}

if (import.meta.env.VITE_APPCHECK_NATIVE === "1" && Capacitor.isNativePlatform()) {
  (async () => {
    try {
      await FirebaseAppCheck.initialize();
      initializeAppCheck(app, {
        provider: new CustomProvider({ getToken: getNativeAppCheckToken }),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      logger.debug("Native App Check (Play Integrity) initialization failed:", err);
    }
  })();
} else if (!Capacitor.isNativePlatform()) {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      logger.debug("App Check initialization failed:", err);
    }
  } else {
    console.error("[Firebase] Missing env variable: VITE_RECAPTCHA_SITE_KEY. App Check will not run until it's set in .env (local) or Vercel Project Settings (production).");
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

// কিছু Android browser/incognito mode-এ IndexedDB ঠিকভাবে কাজ করে না
// (Firebase Auth-এর ডিফল্ট persistence পদ্ধতি), যার ফলে sign-in "Database is
// closing/hidden" জাতীয় error দিয়ে ব্যর্থ হয়। sessionStorage-ভিত্তিক
// persistence অনেক বেশি নির্ভরযোগ্য এবং redirect flow-এর জন্যও যথেষ্ট।
setPersistence(auth, browserLocalPersistence).catch((err) => {
  logger.debug("browserLocalPersistence failed, falling back to session persistence:", err);
  setPersistence(auth, browserSessionPersistence).catch((err2) => {
    logger.debug("Failed to set any persistence, using default:", err2);
  });
});

let db: ReturnType<typeof initializeFirestore>;
if (Capacitor.isNativePlatform()) {
  // IndexedDB-backed persistent cache (persistentLocalCache) is known to
  // hang indefinitely inside embedded Android WebViews on some devices --
  // the IndexedDB "open" handshake never resolves or rejects, so every
  // Firestore read that waits on it never starts (0 bytes on the wire,
  // no error, the UI just stays on its loading skeleton forever). This
  // doesn't happen in a real browser tab or a TWA (Chrome's own engine),
  // which is why the exact same listings screen works there but not here.
  // This is about the embedded WebView itself, not about whether the page
  // is loaded remotely or bundled locally in the APK -- so native builds
  // always skip persistence and just talk to the network directly. No
  // offline cache on native, but reads and writes actually complete.
  // Real-time onSnapshot listeners (chat messages, live threads) need a
  // sustained streaming/WebSocket-style connection to receive updates that
  // weren't part of the initial response. auto-detect usually falls back to
  // long-polling correctly, but on some embedded WebViews (seen here: works
  // fine in the TWA build, which uses the device's real Chrome engine, but
  // silently drops incoming messages in the Capacitor build, which uses a
  // bundled WebView component) detection picks the streaming transport and
  // it never actually delivers later updates -- no error, the listener just
  // goes quiet. Forcing long-polling (plain repeated HTTP requests, not a
  // persistent stream) sidesteps that WebView-specific failure entirely.
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} else {
  try {
    // single-tab persistent cache: avoids the multi-tab lease/lock negotiation
    // that persistentMultipleTabManager() requires, which was adding several
    // seconds of delay every time the app was reopened (a browser often leaves
    // the previous tab/process half-alive in the background, so a new session
    // had to wait for that old tab's lock to expire before it could proceed).
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({}),
    });
  } catch (err) {
    logger.debug("Persistent Firestore cache unavailable, using default in-memory cache:", err);
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  }
}
export { db };

export const storage = getStorage(app);

export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  logger.debug(`Analytics Event: ${eventName}`, eventParams);

  // Only real page visits / login / signup are worth 2 Firestore writes
  // (site_visits.add + analytics_stats/summary increment) each. Click-level
  // events (search, listing_view, select_category, select_location,
  // contact_seller_click, ad_promote, seller_review_submitted, ...) were
  // previously ALSO being sent here and silently relabeled "visit" -- costing
  // 2 extra Firestore writes per click for no benefit, since the admin panel
  // only ever distinguishes "login" / "signup" / generic "visit" anyway.
  // Those events still get the console.debug log above; they just no longer
  // hit Firestore.
  if (eventName !== "login" && eventName !== "signup" && eventName !== "visit") {
    return;
  }

  const type = eventName === "login" ? "login" : eventName === "signup" ? "signup" : "visit";
  try {
    fetch(apiUrl("/api/track-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        uid: eventParams?.uid || null,
        identifier: eventParams?.identifier || null,
        path: typeof window !== "undefined" ? window.location.pathname : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
    }).catch((err) => logger.debug("track-event call failed:", err));
  } catch (err) {
    logger.debug("track-event call failed:", err);
  }
};

export default app;
