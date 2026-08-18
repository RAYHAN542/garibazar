import os

changed_parts = []

path = "src/firebase.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# --- 1) Add App Check import ---
old_import = '''import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, setPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { logger } from "./utils/logger";'''

new_import = '''import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, setPersistence, browserSessionPersistence } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { logger } from "./utils/logger";'''

if "firebase/app-check" in content:
    changed_parts.append("import-already-present")
elif old_import in content:
    content = content.replace(old_import, new_import, 1)
    changed_parts.append("import-added")
else:
    print("[WARN] expected import block not found in src/firebase.ts — check manually")

# --- 2) Add App Check initialization ---
old_init = '''const app = initializeApp(firebaseConfig);'''

new_init = '''const app = initializeApp(firebaseConfig);

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
}'''

if "initializeAppCheck(app" in content:
    changed_parts.append("init-already-present")
elif old_init in content:
    content = content.replace(old_init, new_init, 1)
    changed_parts.append("init-added")
else:
    print("[WARN] expected 'const app = initializeApp' line not found — check manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_add_app_check.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

ok_fresh = {"import-added", "init-added"}
ok_rerun = {"import-already-present", "init-already-present"}
got = set(changed_parts)

if ok_fresh.issubset(got) or ok_rerun.issubset(got):
    print("[OK] App Check (reCAPTCHA v3) src/firebase.ts-এ যোগ হয়েছে।")
    print("মনে রাখবেন: Vercel-এ VITE_RECAPTCHA_SITE_KEY env variable বসাতে হবে, নাহলে App Check চালু হবে না।")
else:
    print(f"[PARTIAL] চেক করুন: {(ok_fresh - got)}")
