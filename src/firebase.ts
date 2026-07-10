import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB8HnVfzI1YmP1X2r_lLWu-2YQKyKPTcdc",
  authDomain: "garibazar-bd.firebaseapp.com",
  projectId: "garibazar-bd",
  storageBucket: "garibazar-bd.firebasestorage.app",
  messagingSenderId: "466216231725",
  appId: "1:466216231725:web:ef296db7e40221d4e269a4",
  measurementId: "G-9SKYKBPRCE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Google সাইন-ইন প্রোভাইডার — ফোন OTP এর বদলে ব্যবহার করা হচ্ছে (কোনো SMS গেটওয়ে লাগবে না)
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app);

// অন্যান্য কম্পোনেন্টের বিল্ড এরর দূর করার জন্য এই ফাংশনটি এক্সপোর্ট করা হলো
export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  console.log(`Analytics Event: ${eventName}`, eventParams);
};

export default app;
