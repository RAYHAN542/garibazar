import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// Initialize Firestore
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const storage = getStorage(app);

export default app;
