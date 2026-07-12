import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB8HnVfzI1YmP1X2r_lLWu-2YQKyKPTcdc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "garibazar-bd.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "garibazar-bd",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "garibazar-bd.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "466216231725",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:466216231725:web:ef296db7e40221d4e269a4",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9SKYKBPRCE"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app);

export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  console.log(`Analytics Event: ${eventName}`, eventParams);
};

export default app;
