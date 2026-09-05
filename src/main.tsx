import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { logger } from "./utils/logger";
import "./index.css";

import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener("backButton", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  });

  // App Links: AndroidManifest.xml-এর intent-filter (garibazar.shop) থেকে
  // আসা https://garibazar.shop/l/{id} লিংক ধরে সেটাকে App.tsx-এর ইতিমধ্যে
  // থাকা ?listing={id} query-param handling-এ পাঠানো হচ্ছে -- ওয়েবে
  // /l/{id} → api/share-listing.ts যেভাবে ব্রাউজারকে /?listing={id}-এ
  // রিডাইরেক্ট করে, ঠিক সেই একই রুট এখানে অনুকরণ করা হলো। শুধু ম্যানিফেস্টে
  // intent-filter যোগ করলেই যথেষ্ট না -- সেটা অ্যাপ খুলে দেয় ঠিকই, কিন্তু
  // এই listener ছাড়া নির্দিষ্ট লিস্টিং না দেখিয়ে হোমপেজেই থেকে যেত।
  CapacitorApp.addListener("appUrlOpen", (data) => {
    try {
      const url = new URL(data.url);
      const match = url.pathname.match(/^\/l\/([^/?#]+)/);
      if (match) {
        const listingId = match[1];
        // history.replaceState + একটা synthetic popstate যথেষ্ট হতো না --
        // App.tsx-এর "?listing=" পড়ার effect শুধু mount-এ ও `listings`
        // অ্যারে বদলালে চলে, popstate শোনে না। তাই সরাসরি navigate করে
        // App.tsx-কে ফ্রেশভাবে mount করানো হচ্ছে, ঠিক যেভাবে ওয়েবে সরাসরি
        // এই URL-এ ঢুকলে হতো।
        window.location.href = `/?listing=${encodeURIComponent(listingId)}`;
      }
    } catch (err) {
      console.warn("Failed to handle app URL open:", err);
    }
  });
}



// Register Service Worker for PWA (Lighthouse Audit / Google Play Store compatibility)
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  let refreshing = false;
  // When a new service worker takes control, reload once so the user
  // immediately gets the latest bundle instead of a stale cached one.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => {
        logger.debug("PWA Service Worker registered successfully:", reg.scope);
      })
      .catch((err) => {
        console.warn("PWA Service Worker registration failed:", err);
      });
  });
}

// অ্যাপ শেলের ভেতরে ছবি/লিংকে লং-প্রেস করলে ব্রাউজারের নিজস্ব
// "Copy image / Share / Open in browser" মেনু আসা ঠেকানো হচ্ছে — নেটিভ
// অ্যাপ-এর মতো ফিল আনতে। ইনপুট/টেক্সটএরিয়াতে এটা প্রযোজ্য না, যাতে ফর্মে
// স্বাভাবিকভাবে কপি-পেস্ট করা যায়।
if (typeof window !== "undefined") {
  document.addEventListener(
    "contextmenu",
    (e) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (!isEditable) {
        e.preventDefault();
      }
    },
    { capture: true }
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Hide the native splash screen once the React shell has actually painted --
// requestAnimationFrame (twice, to be safe across devices) waits for the
// browser to have completed at least one real paint of the mounted app,
// instead of hiding the instant .render() is *called* (which can still be
// before anything is on screen) or waiting for Firestore data (which would
// bring back the exact blank-wait this is meant to fix).
if (Capacitor.isNativePlatform()) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      SplashScreen.hide().catch(() => {
        // Non-fatal -- if this fails for any reason, Android's own launch
        // theme background has already been showing since cold start, so
        // the user was never looking at a truly blank screen.
      });
    });
  });
}
