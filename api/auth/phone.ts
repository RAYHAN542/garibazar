/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ============================================================
// api/auth/phone.ts  (Firebase → Supabase migration, Phase 1)
// ============================================================
// আগে এটা Firestore + firebase-admin দিয়ে পাসওয়ার্ড চেক করে Firebase
// custom token ফেরত দিত। এখন Supabase Auth-ই পাসওয়ার্ডের আসল মালিক --
// এই ফাইল শুধু দুইটা কাজ করে:
//
//   ১. পুরনো (Firestore-migrated) ইউজারদের জন্য "lazy migration" ব্রিজ --
//      legacy_phone_auth টেবিলে থাকা পুরনো scrypt hash মিলিয়ে দেখে,
//      মিললে নিঃশব্দে Supabase Auth-এ রিয়েল অ্যাকাউন্ট বানিয়ে দেয় আর
//      migrate_legacy_uid() RPC কল করে তাদের পুরনো ডেটা (listings,
//      chats, ইত্যাদি) নতুন UUID-এর সাথে re-link করে দেয়। ইউজার কিছুই
//      টের পায় না -- স্বাভাবিক লগইনই মনে হয়।
//   ২. নতুন signup-এর জন্য সরাসরি Supabase Auth-এ অ্যাকাউন্ট বানায়
//      (phone_confirm: true দিয়ে, তাই SMS OTP লাগে না -- আগের মতোই)।
//
// দুই ক্ষেত্রেই শেষে server-side signInWithPassword() কল করে আসল
// Supabase session (access_token/refresh_token) বানিয়ে ক্লায়েন্টকে
// ফেরত দেওয়া হয়। ক্লায়েন্ট সেটা supabase.auth.setSession() দিয়ে
// adopt করবে (AuthModal.tsx-এ পরের ধাপে করা হবে)।
//
// action: "login" | "signup" body ফিল্ড দিয়ে বলে দিতে হবে কোনটা।

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { applyCors } from "../_lib/cors.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// service-role client: RLS বাইপাস করে, তাই এটা কখনো ক্লায়েন্টে পাঠানো
// হয় না -- শুধু এই সার্ভার ফাংশনের ভেতরেই থাকে।
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// signInWithPassword() আসলে Supabase-এর নিজস্ব GoTrue auth সার্ভারে
// যায় (RLS/service-role-এর আওতার বাইরে), তাই এর জন্য আলাদা anon-key
// ক্লায়েন্ট লাগে -- admin ক্লায়েন্ট দিয়ে password verify করা যায় না।
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10; // 10 attempts/min per IP

function normalizeBanglaPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

// 🔧 public.users.phone পুরনো ডেটায় local format-এ আছে ("01XXXXXXXXX"),
// কিন্তু normalizeBanglaPhone() সবসময় "+880XXXXXXXXX" ফেরত দেয় -- এই
// mismatch-এর কারণে oldUid lookup সবসময় null পেত, ফলে password ঠিক
// থাকলেও migrate_legacy_uid() কখনো চলত না আর user-এর পুরনো listing/chat/
// purchase ডেটা নতুন অ্যাকাউন্টের সাথে link হতো না। দুই format-ই চেক করা
// হচ্ছে যাতে stored data যেকোনো ফরম্যাটেই থাকুক না কেন মিলে যায়।
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
    return true; // rate-limiter নিজেই ভেঙে গেলে লগইন ব্লক করে দেওয়া ঠিক না
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

// signInWithPassword() করে আসল Supabase session বানিয়ে ফেরত দেয়।
async function signInAndRespond(res: any, phone: string, password: string) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ phone, password });
  if (error || !data.session) {
    console.error("post-provision signInWithPassword failed:", error);
    return res.status(500).json({ error: "লগইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" });
  }
  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    uid: data.user.id,
    phone,
  });
}

async function handleLogin(req: any, res: any) {
  const phone = normalizeBanglaPhone(req.body?.phone);
  const password = String(req.body?.password || "");

  if (!phone || !password) {
    return res.status(400).json({ error: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });
  }

  const lockStatus = await checkLockout(phone);
  if (lockStatus.locked) {
    return res.status(429).json({
      error: `অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${lockStatus.waitMin} মিনিট পর আবার চেষ্টা করুন।`,
    });
  }

  // ধাপ ১: ইতিমধ্যে Supabase Auth-এ থাকা ইউজার কিনা (নতুন signup, বা
  // আগেই lazy-migrate হয়ে যাওয়া পুরনো ইউজার) -- সরাসরি Supabase নিজেই
  // পাসওয়ার্ড verify করবে।
  {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ phone, password });
    if (!error && data.session) {
      await clearFailedAttempts(phone);
      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        uid: data.user.id,
        phone,
      });
    }
  }

  // ধাপ ২: Supabase-এ নেই/পাসওয়ার্ড মেলেনি -- পুরনো (Firestore থেকে
  // migrate করা) legacy hash-এর বিরুদ্ধে চেক করা হচ্ছে।
  const { data: legacy } = await supabaseAdmin
    .from("legacy_phone_auth")
    .select("password_hash, salt")
    .eq("phone", phone)
    .maybeSingle();

  if (!legacy) {
    return res.status(404).json({
      error: "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করুন।",
      code: "NOT_REGISTERED",
    });
  }

  const computedHash = hashLegacyPassword(password, legacy.salt);
  const stored = Buffer.from(legacy.password_hash, "hex");
  const computed = Buffer.from(computedHash, "hex");
  const matches = stored.length === computed.length && crypto.timingSafeEqual(stored, computed);

  if (!matches) {
    await bumpFailedAttempt(phone);
    return res.status(400).json({ error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" });
  }

  await clearFailedAttempts(phone);

  // ধাপ ৩: পাসওয়ার্ড মিলেছে -- এখনই নিঃশব্দে lazy-migrate করে ফেলা।
  // public.users-এ তাদের পুরনো (Firestore) uid এখনো বসে আছে, সেটা
  // আগে থেকে পড়ে রাখতে হবে -- admin.createUser() নতুন auth.users রো
  // বানানোর সাথে সাথেই trigger নতুন uid দিয়ে একটা blank users রো বানিয়ে
  // ফেলবে, তাই পুরনো uid টা তার আগেই জেনে রাখা জরুরি।
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
    return res.status(500).json({ error: "লগইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" });
  }
  const newUid = created.user.id;

  if (oldUid) {
    const { error: relinkErr } = await supabaseAdmin.rpc("migrate_legacy_uid", {
      p_old_uid: oldUid,
      p_new_uid: newUid,
    });
    if (relinkErr) {
      // ডেটা re-link ব্যর্থ হলে half-migrated অবস্থায় ছেড়ে দেওয়া
      // ঠিক না -- লগ রেখে transient error হিসেবে জানানো হচ্ছে, retry
      // করলে আবার একই ব্রিজ-পাথ ট্রাই হবে (auth.users-এ রো তৈরি হয়ে
      // গেলেও legacy_phone_auth ডিলিট হয়নি, তাই এই ফ্লো আবার চলবে,
      // শুধু createUser() দ্বিতীয়বার ফেইল করবে -- সেই কেসটাও handle
      // করার দরকার হলে ভবিষ্যতে upsert-style করা যাবে)।
      console.error("migrate_legacy_uid RPC failed:", relinkErr);
      return res.status(500).json({ error: "লগইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" });
    }
  }

  // পুরনো legacy hash আর দরকার নেই।
  await supabaseAdmin.from("legacy_phone_auth").delete().eq("phone", phone);

  return signInAndRespond(res, phone, password);
}

async function handleSignup(req: any, res: any) {
  const phone = normalizeBanglaPhone(req.body?.phone);
  const password = String(req.body?.password || "");

  if (!phone) {
    return res.status(400).json({ error: "সঠিক মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)।" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।" });
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
      error: "এই নম্বরে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।",
      code: "ALREADY_REGISTERED",
    });
  }

  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true, // SMS OTP costs এড়াতে -- এখন যেভাবে চলছে, ঠিক তেমনই
  });
  if (createErr) {
    console.error("signup createUser failed:", createErr);
    return res.status(500).json({ error: "অ্যাকাউন্ট তৈরি করা যায়নি। আবার চেষ্টা করুন।" });
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
      return res.status(429).json({ error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: "সার্ভার কনফিগারেশনে সমস্যা।" });
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
    return res.status(500).json({ error: "অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" });
  }
}
