import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, setPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { logger } from "./utils/logger";

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
// IMPORTANT (rollout safety): this only starts sending App Check tokens.
// It does NOT block anything by itself. Enforcement is turned on separately,
// later, from Firebase Console -> App Check -> APIs tab (Firestore/Storage),
// only after a few days of confirming real traffic has valid tokens. Do NOT
// flip that switch until told to -- turning it on too early can lock
// everyone (including the admin) out of the site.
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

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

// কিছু Android browser/incognito mode-এ IndexedDB ঠিকভাবে কাজ করে না
// (Firebase Auth-এর ডিফল্ট persistence পদ্ধতি), যার ফলে sign-in "Database is
// closing/hidden" জাতীয় error দিয়ে ব্যর্থ হয়। sessionStorage-ভিত্তিক
// persistence অনেক বেশি নির্ভরযোগ্য এবং redirect flow-এর জন্যও যথেষ্ট।
setPersistence(auth, browserSessionPersistence).catch((err) => {
  logger.debug("Failed to set browserSessionPersistence, using default:", err);
});

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app);

export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  logger.debug(`Analytics Event: ${eventName}`, eventParams);
  const type = eventName === "login" ? "login" : eventName === "signup" ? "signup" : "visit";
  try {
    fetch("/api/track-event", {
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
