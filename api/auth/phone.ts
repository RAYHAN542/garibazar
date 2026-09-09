/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function normalizeBanglaPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

function localBanglaPhoneVariant(e164Phone: string): string {
  return "0" + e164Phone.replace("+880", "");
}

function hashLegacyPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

async function checkRateLimit(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("check_and_bump_rate_limit", {
    p_key: key,
    p_window_ms: RATE_LIMIT_WINDOW_MS,
    p_max_count: RATE_LIMIT_MAX,
  });
  if (error) {
    console.error("rate limit RPC failed, failing open:", error);
    return true;
  }
  return data === true;
}

async function checkLockout(phone: string): Promise<{ locked: boolean; waitMin?: number }> {
  const { data } = await supabaseAdmin
    .from("login_lockouts")
    .select("lock_until")
    .eq("phone", phone)
    .maybeSingle();
  if (data?.lock_until && new Date(data.lock_until).getTime() > Date.now()) {
    const waitMin = Math.ceil((new Date(data.lock_until).getTime() - Date.now()) / 60000);
    return { locked: true, waitMin };
  }
  return { locked: false };
}

async function bumpFailedAttempt(phone: string) {
  const { data } = await supabaseAdmin
    .from("login_lockouts")
    .select("failed_attempts")
    .eq("phone", phone)
    .maybeSingle();
  const failedAttempts = (data?.failed_attempts || 0) + 1;
  const patch: any = { phone, failed_attempts: failedAttempts, updated_at: new Date().toISOString() };
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    patch.lock_until = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    patch.failed_attempts = 0;
  }
  await supabaseAdmin.from("login_lockouts").upsert(patch);
}

async function clearFailedAttempts(phone: string) {
  await supabaseAdmin.from("login_lockouts").delete().eq("phone", phone);
}

async function mintFirebaseToken(appUid: string): Promise<string | null> {
  if (!getApps().length) return null;
  try {
    return await getAuth().createCustomToken(appUid);
  } catch (e) {
    console.error("[phone auth] mintFirebaseToken failed (non-fatal):", e);
    return null;
  }
}

async function signInAndRespond(res: any, phone: string, password: string) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ phone, password });
  if (error || !data.session) {
    console.error("post-provision signInWithPassword failed:", error);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    uid: data.user.id,
    auth_uid: data.user.id,
    phone,
    firebaseToken: await mintFirebaseToken(data.user.id),
  });
}

async function handleLogin(req: any, res: any) {
  const phone = normalizeBanglaPhone(req.body?.phone);
  const password = String(req.body?.password || "");

  if (!phone || !password) {
    return res.status(400).json({ error: "Enter phone number and password." });
  }

  const lockStatus = await checkLockout(phone);
  if (lockStatus.locked) {
    return res.status(429).json({
      error: `Too many wrong attempts. Try again in ${lockStatus.waitMin} minutes.`,
    });
  }

  {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ phone, password });
    if (!error && data.session) {
      await clearFailedAttempts(phone);
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        uid: data.user.id,
        auth_uid: data.user.id,
        phone,
        firebaseToken: await mintFirebaseToken(data.user.id),
      });
    }
  }

  const { data: legacy } = await supabaseAdmin
    .from("legacy_phone_auth")
    .select("password_hash, salt")
    .eq("phone", phone)
    .maybeSingle();

  if (!legacy) {
    return res.status(404).json({
      error: "No account found for this number. Please create a new account.",
      code: "NOT_REGISTERED",
    });
  }

  const computedHash = hashLegacyPassword(password, legacy.salt);
  const stored = Buffer.from(legacy.password_hash, "hex");
  const computed = Buffer.from(computedHash, "hex");
  const matches = stored.length === computed.length && crypto.timingSafeEqual(stored, computed);

  if (!matches) {
    await bumpFailedAttempt(phone);
    return res.status(400).json({ error: "Wrong password. Try again." });
  }

  await clearFailedAttempts(phone);

  const { data: oldUserRow } = await supabaseAdmin
    .from("users")
    .select("uid")
    .or(`phone.eq.${phone},phone.eq.${localBanglaPhoneVariant(phone)}`)
    .maybeSingle();
  const oldUid = oldUserRow?.uid || null;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });
  if (createErr || !created?.user) {
    console.error("lazy-migration createUser failed:", createErr);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
  const newUid = created.user.id;

  if (oldUid) {
    const { error: relinkErr } = await supabaseAdmin.rpc("migrate_legacy_uid", {
      p_old_uid: oldUid,
      p_new_uid: newUid,
    });
    if (relinkErr) {
      console.error("migrate_legacy_uid RPC failed:", relinkErr);
      return res.status(500).json({ error: "Login failed. Please try again." });
    }
  }

  await supabaseAdmin.from("legacy_phone_auth").delete().eq("phone", phone);

  return signInAndRespond(res, phone, password);
}

async function handleSignup(req: any, res: any) {
  const phone = normalizeBanglaPhone(req.body?.phone);
  const password = String(req.body?.password || "");

  if (!phone) {
    return res.status(400).json({ error: "Enter a valid phone number (e.g. 01XXXXXXXXX)." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("uid")
    .or(`phone.eq.${phone},phone.eq.${localBanglaPhoneVariant(phone)}`)
    .maybeSingle();
  const { data: existingLegacy } = await supabaseAdmin
    .from("legacy_phone_auth")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();

  if (existingUser || existingLegacy) {
    return res.status(409).json({
      error: "An account already exists for this number. Please log in.",
      code: "ALREADY_REGISTERED",
    });
  }

  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });
  if (createErr) {
    console.error("signup createUser failed:", createErr);
    return res.status(500).json({ error: "Could not create account. Please try again." });
  }

  return signInAndRespond(res, phone, password);
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const clientIp = getClientIp(req);
    const allowed = await checkRateLimit(`phone_auth_ip_${clientIp}`);
    if (!allowed) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "Server configuration error." });
    }

    const action = req.body?.action;
    if (action === "signup") {
      return await handleSignup(req, res);
    } else if (action === "login") {
      return await handleLogin(req, res);
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }
  } catch (err: any) {
    console.error("phone auth failed:", err);
    return res.status(500).json({ error: "Request failed. Please try again." });
  }
}
