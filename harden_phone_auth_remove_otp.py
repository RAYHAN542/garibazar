#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1. Hardens the password-based phone login/signup:
   - minimum password length 6 -> 8 (signup only)
   - adds IP-based rate limiting (in-memory, same pattern as
     api/track-event.ts) to phone-login and phone-signup, so a script
     can't rapid-fire test many different phone numbers per minute
   (The distinct "account not found" vs "wrong password" response is kept
   as-is on purpose - it powers the auto-redirect-to-signup UX in
   AuthModal.tsx, and that UX was chosen over closing the minor
   phone-number-enumeration gap it implies.)

2. Removes the now-unused OTP routes (api/auth/send-otp.ts,
   api/auth/verify-otp.ts + their server.ts wiring) - confirmed unused,
   AuthModal.tsx only calls phone-login/phone-signup.

Run from the project root (the folder containing `src/`):
    python3 harden_phone_auth_remove_otp.py
"""
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def patch(path: Path, replacements, label):
    if not path.exists():
        print(f"[SKIP] {label}: file not found at {path}")
        return
    text = nfc(path.read_text(encoding="utf-8"))
    changed = False
    for old, new in replacements:
        old_n, new_n = nfc(old), nfc(new)
        if old_n not in text:
            print(f"[WARN] {label}: expected snippet not found, skipping one replacement")
            continue
        text = text.replace(old_n, new_n, 1)
        changed = True
    if changed:
        path.write_text(text, encoding="utf-8")
        print(f"[OK] {label}: patched")
    else:
        print(f"[SKIP] {label}: nothing changed")


RATE_LIMIT_HELPER = '''
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10; // 10 attempts/min per IP - generous for a real user, tight for a script
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}
'''

# ---------- phone-login.ts ----------
login_path = ROOT / "api" / "auth" / "phone-login.ts"
patch(
    login_path,
    [(
        'function hashPassword(password: string, salt: string): string {\n  return crypto.scryptSync(password, salt, 64).toString("hex");\n}',
        'function hashPassword(password: string, salt: string): string {\n  return crypto.scryptSync(password, salt, 64).toString("hex");\n}\n' + RATE_LIMIT_HELPER,
    ), (
        '  try {\n    if (!getApps().length) {\n      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });\n    }\n\n    const phone = normalizeBanglaPhone(req.body?.phone);\n    const password = String(req.body?.password || "");\n\n    if (!phone || !password) {\n      return res.status(400).json({ error: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });\n    }',
        '  try {\n    const clientIp = getClientIp(req);\n    if (isRateLimited(clientIp)) {\n      return res.status(429).json({ error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });\n    }\n\n    if (!getApps().length) {\n      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });\n    }\n\n    const phone = normalizeBanglaPhone(req.body?.phone);\n    const password = String(req.body?.password || "");\n\n    if (!phone || !password) {\n      return res.status(400).json({ error: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });\n    }',
    )],
    "phone-login.ts (rate limit)",
)

# ---------- phone-signup.ts ----------
signup_path = ROOT / "api" / "auth" / "phone-signup.ts"
patch(
    signup_path,
    [(
        'function hashPassword(password: string, salt: string): string {\n  return crypto.scryptSync(password, salt, 64).toString("hex");\n}',
        'function hashPassword(password: string, salt: string): string {\n  return crypto.scryptSync(password, salt, 64).toString("hex");\n}\n' + RATE_LIMIT_HELPER,
    ), (
        '  try {\n    if (!getApps().length) {\n      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });\n    }\n\n    const phone = normalizeBanglaPhone(req.body?.phone);\n    const password = String(req.body?.password || "");\n\n    if (!phone) {\n      return res.status(400).json({ error: "সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।" });\n    }\n    if (password.length < 6) {\n      return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।" });\n    }',
        '  try {\n    const clientIp = getClientIp(req);\n    if (isRateLimited(clientIp)) {\n      return res.status(429).json({ error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });\n    }\n\n    if (!getApps().length) {\n      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });\n    }\n\n    const phone = normalizeBanglaPhone(req.body?.phone);\n    const password = String(req.body?.password || "");\n\n    if (!phone) {\n      return res.status(400).json({ error: "সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।" });\n    }\n    if (password.length < 8) {\n      return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।" });\n    }',
    )],
    "phone-signup.ts (rate limit + min password length 8)",
)

# ---------- Remove unused OTP routes ----------
otp_files = ["api/auth/send-otp.ts", "api/auth/verify-otp.ts"]
removed, skipped = [], []
for rel in otp_files:
    p = ROOT / rel
    if p.exists():
        p.unlink()
        removed.append(rel)
    else:
        skipped.append(rel)
if removed:
    print(f"[OK] removed {len(removed)} unused OTP file(s): {', '.join(removed)}")
if skipped:
    print(f"[SKIP] already removed: {', '.join(skipped)}")

server_ts = ROOT / "server.ts"
if server_ts.exists():
    text = server_ts.read_text(encoding="utf-8")
    original = text
    text = text.replace('import sendOtpHandler from "./api/auth/send-otp";\n', "")
    text = text.replace('import verifyOtpHandler from "./api/auth/verify-otp";\n', "")
    text = text.replace('app.post("/api/auth/send-otp", sendOtpHandler);\n', "")
    text = text.replace('app.post("/api/auth/verify-otp", verifyOtpHandler);\n', "")
    if text != original:
        server_ts.write_text(text, encoding="utf-8")
        print("[OK] server.ts: removed send-otp/verify-otp imports and routes")
    else:
        print("[SKIP] server.ts: nothing to change (already clean)")

print("\n[DONE] phone auth hardened, OTP routes removed.")
