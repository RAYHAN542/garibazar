import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, setLogLevel } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAnalytics, logEvent } from "firebase/analytics";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";

// Validate Firebase env vars in production
if (import.meta.env.PROD) {
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN', 
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  for (const v of requiredVars) {
    if (!import.meta.env[v]) {
      throw new Error(`Missing required environment variable: ${v}. Set it in your hosting provider's environment settings.`);
    }
  }
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
  if (recaptchaKey.startsWith('6Ld_dummy')) {
    throw new Error('VITE_RECAPTCHA_SITE_KEY is still a placeholder. Replace it with your real reCAPTCHA v3 site key.');
  }
}

// Read Firebase configurations strictly from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Silence Firestore transport warnings
setLogLevel('error');

// App Check debug token disabled in production

// Initialize App Check
export let appCheck: any = null;
if (typeof window !== "undefined") {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6Ld_dummy_site_key_replace_me_in_production";
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
    console.log("Firebase App Check initialized successfully with provider: reCAPTCHA v3");
  } catch (error) {
    console.warn("Could not load App Check (this is expected if no valid site key or if offline):", error);
  }
}

// Initialize Firebase services with auto long-polling to prevent WebSocket connection failures in sandbox iframes
export const auth = getAuth(app);
export const db = initializeFirestore(
  app,
  { experimentalAutoDetectLongPolling: true },
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)"
);
export const storage = getStorage(app);

// Initialize Firebase Analytics gracefully
export let analytics: any = null;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized successfully");
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized:", error);
  }
}

// Helper to log analytics events safely
export function logAnalyticsEvent(eventName: string, params?: any) {
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      console.log(`[Analytics Event Logged] ${eventName}:`, params);
    } catch (err) {
      console.error("Failed to log analytics event:", err);
    }
  } else {
    console.log(`[Simulation Analytics Log] ${eventName}:`, params);
  }
}

// Initialize Firebase Cloud Messaging (FCM) gracefully
export let messaging: any = null;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
    console.log("Firebase Cloud Messaging initialized successfully");
  } catch (error) {
    console.warn("Firebase Cloud Messaging is not supported or failed to initialize:", error);
  }
}



