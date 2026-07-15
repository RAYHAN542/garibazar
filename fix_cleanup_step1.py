import os

changed_parts = []

# ---------------------------------------------------------------
# 1) Delete stray duplicate/backup files left over from past sessions
# ---------------------------------------------------------------
stray_files = [
    "src/App.tsx.txt",
    "src/App.tsx (7).txt",
    "src/RefillModal.tsx.txt",
    "src/components/RefillModal.tsx.txt",
    "src/PromoteAdModal.tsx.txt",
    "src/components/PromoteAdModal.tsx.txt",
]
removed = []
for f in stray_files:
    if os.path.exists(f):
        os.remove(f)
        removed.append(f)
if removed:
    changed_parts.append("stray-files")

# ---------------------------------------------------------------
# 2) src/firebase.ts — remove hardcoded Firebase key fallback
# ---------------------------------------------------------------
path_fb = "src/firebase.ts"
with open(path_fb, "r", encoding="utf-8") as f:
    fb = f.read()

old_fb = '''const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB8HnVfzI1YmP1X2r_lLWu-2YQKyKPTcdc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "garibazar-bd.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "garibazar-bd",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "garibazar-bd.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "466216231725",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:466216231725:web:ef296db7e40221d4e269a4",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9SKYKBPRCE"
};'''

new_fb = '''const requiredEnv = (key: string, value: string | undefined): string => {
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
};'''

if old_fb in fb:
    fb = fb.replace(old_fb, new_fb, 1)
    changed_parts.append("firebase-key")

old_fb_log = '''export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  console.log(`Analytics Event: ${eventName}`, eventParams);
};'''
new_fb_log = '''export const logAnalyticsEvent = (eventName: string, eventParams?: any) => {
  logger.debug(`Analytics Event: ${eventName}`, eventParams);
};'''
if old_fb_log in fb:
    fb = fb.replace(old_fb_log, new_fb_log, 1)
    changed_parts.append("firebase-log")

old_fb_import = 'import { getStorage } from "firebase/storage";'
new_fb_import = 'import { getStorage } from "firebase/storage";\nimport { logger } from "./utils/logger";'
if old_fb_import in fb and 'import { logger } from "./utils/logger";' not in fb:
    fb = fb.replace(old_fb_import, new_fb_import, 1)
    changed_parts.append("firebase-import")

with open(path_fb, "w", encoding="utf-8") as f:
    f.write(fb)

# ---------------------------------------------------------------
# 3) src/main.tsx — swap raw console.log for gated logger
# ---------------------------------------------------------------
path_main = "src/main.tsx"
with open(path_main, "r", encoding="utf-8") as f:
    main_ts = f.read()

old_main_import = 'import { ErrorBoundary } from "./components/ErrorBoundary.tsx";'
new_main_import = 'import { ErrorBoundary } from "./components/ErrorBoundary.tsx";\nimport { logger } from "./utils/logger";'
if old_main_import in main_ts and 'import { logger } from "./utils/logger";' not in main_ts:
    main_ts = main_ts.replace(old_main_import, new_main_import, 1)
    changed_parts.append("main-import")

old_main_log = '        console.log("PWA Service Worker registered successfully:", reg.scope);'
new_main_log = '        logger.debug("PWA Service Worker registered successfully:", reg.scope);'
if old_main_log in main_ts:
    main_ts = main_ts.replace(old_main_log, new_main_log, 1)
    changed_parts.append("main-log")

with open(path_main, "w", encoding="utf-8") as f:
    f.write(main_ts)

# ---------------------------------------------------------------
# 4) src/App.tsx — swap raw console.log for gated logger
# ---------------------------------------------------------------
path_app = "src/App.tsx"
with open(path_app, "r", encoding="utf-8") as f:
    app_ts = f.read()

old_app_import = 'import { auth, db, logAnalyticsEvent } from "./firebase";'
new_app_import = 'import { auth, db, logAnalyticsEvent } from "./firebase";\nimport { logger } from "./utils/logger";'
if old_app_import in app_ts and 'import { logger } from "./utils/logger";' not in app_ts:
    app_ts = app_ts.replace(old_app_import, new_app_import, 1)
    changed_parts.append("app-import")

app_log_pairs = [
    (
        '        console.log("Captured prefilled referral code:", refCode);',
        '        logger.debug("Captured prefilled referral code:", refCode);',
    ),
    (
        '          console.log("Firestore empty in production. No listings to show.");',
        '          logger.debug("Firestore empty in production. No listings to show.");',
    ),
    (
        '          console.log("Firestore empty. Fallback to offline mock car parts listings.");',
        '          logger.debug("Firestore empty. Fallback to offline mock car parts listings.");',
    ),
    (
        '      console.log(`Resetting ${expiredAds.length} expired ad promotions...`);',
        '      logger.debug(`Resetting ${expiredAds.length} expired ad promotions...`);',
    ),
]
app_hits = 0
for old, new in app_log_pairs:
    if old in app_ts:
        app_ts = app_ts.replace(old, new, 1)
        app_hits += 1
if app_hits:
    changed_parts.append(f"app-logs:{app_hits}")

with open(path_app, "w", encoding="utf-8") as f:
    f.write(app_ts)

# ---------------------------------------------------------------
# 5) src/utils/cloudinary.ts — swap raw console.log for gated logger
#    (console.error calls are left as-is — errors should always log)
# ---------------------------------------------------------------
path_cl = "src/utils/cloudinary.ts"
with open(path_cl, "r", encoding="utf-8") as f:
    cl = f.read()

old_cl_first_line = 'export const uploadToCloudinary = async (file: File | Blob): Promise<string> => {'
new_cl_first_line = 'import { logger } from "./logger";\n\nexport const uploadToCloudinary = async (file: File | Blob): Promise<string> => {'
if old_cl_first_line in cl and 'import { logger } from "./logger";' not in cl:
    cl = cl.replace(old_cl_first_line, new_cl_first_line, 1)
    changed_parts.append("cloudinary-import")

cl_log_pairs = [
    (
        '  console.log(`[Cloudinary] Starting upload to ${url} with preset ${uploadPreset}`);',
        '  logger.debug(`[Cloudinary] Starting upload to ${url} with preset ${uploadPreset}`);',
    ),
    (
        '    console.log(`[Cloudinary] Response status: ${response.status} ${response.statusText}`);',
        '    logger.debug(`[Cloudinary] Response status: ${response.status} ${response.statusText}`);',
    ),
    (
        '    console.log(`[Cloudinary] Upload successful, received URL: ${data.secure_url}`);',
        '    logger.debug(`[Cloudinary] Upload successful, received URL: ${data.secure_url}`);',
    ),
]
cl_hits = 0
for old, new in cl_log_pairs:
    if old in cl:
        cl = cl.replace(old, new, 1)
        cl_hits += 1
if cl_hits:
    changed_parts.append(f"cloudinary-logs:{cl_hits}")

with open(path_cl, "w", encoding="utf-8") as f:
    f.write(cl)

# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------
print("=== fix_cleanup_step1.py রেজাল্ট ===")
print(f"Removed stray files ({len(removed)}):", removed if removed else "কিছু পাওয়া যায়নি (আগেই মুছা থাকতে পারে)")
print("Patched sections:", changed_parts)

expected = {
    "stray-files", "firebase-key", "firebase-log", "firebase-import",
    "main-import", "main-log", "app-import", "app-logs:4",
    "cloudinary-import", "cloudinary-logs:3",
}
got = set(changed_parts)
if got == expected:
    print("[OK] সব প্যাচ সফলভাবে apply হয়েছে।")
else:
    print(f"[PARTIAL] এই অংশগুলো miss হয়েছে: {expected - got} — ম্যানুয়ালি চেক করো।")
