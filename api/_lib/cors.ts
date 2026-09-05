// Shared CORS handling for API endpoints that the app's own frontend calls
// directly with fetch().
//
// The Android app now loads its HTML/JS from files bundled inside the APK
// (capacitor.config.ts has no server.url), so its own origin is
// "https://localhost" -- while these API endpoints still run on
// "https://garibazar.shop". That makes every fetch() call from the native
// app a genuinely cross-origin request, so the WebView enforces normal
// browser CORS rules on it. Without these headers present on the response,
// the request is blocked before it ever reaches this function's own code
// (no server log line is even produced), which is why every client-called
// endpoint must call this first, before any other logic.
//
// Only the real website (+ its www alias) and the bundled Android app's
// fixed "https://localhost" origin ever legitimately call these endpoints,
// so the allow-list stays narrow instead of reflecting back any arbitrary
// Origin header a caller sends.
const ALLOWED_ORIGINS = new Set([
  "https://garibazar.shop",
  "https://www.garibazar.shop",
  "https://localhost", // Capacitor Android (bundled app)
]);

// Call this as the very first line of every handler that the app's own
// frontend calls with fetch(). Returns true if this was a CORS preflight
// (OPTIONS) request that has already been fully answered -- the caller
// must `return` immediately in that case and run no other code.
export function applyCors(req: any, res: any): boolean {
  const origin = req.headers?.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
