import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { logger } from "./utils/logger";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
