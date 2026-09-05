/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor } from "@capacitor/core";

// Capacitor (the native Android app) now loads its HTML/JS from the files
// bundled inside the APK -- not from garibazar.shop -- so its own origin is
// https://localhost. A relative fetch("/api/...") from inside that shell
// would try to hit https://localhost/api/..., which doesn't exist, instead
// of the real backend. In the browser and in the TWA, the page IS served
// from garibazar.shop, so a relative path is already correct there (and
// better -- it keeps working on preview/staging deployments without
// hardcoding a domain).
const API_ORIGIN = "https://garibazar.shop";

export function apiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `${API_ORIGIN}${path}`;
  }
  return path;
}
