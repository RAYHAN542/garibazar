import { createClient } from "@supabase/supabase-js";
import { applyCors } from "../_lib/cors.js";

let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment is not configured");
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function toEnglishDigits(raw: string): string {
  return String(raw || "").replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
}

function normalizeBanglaPhone(raw: string): string | null {
  const digits = toEnglishDigits(raw).replace(/[^\d]/g, "");
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  if (local.startsWith("0")) local = local.slice(1);
  if (!/^1[3-9]\d{8}$/.test(local)) return null;
  return `+880${local}`;
}

function getClientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0].split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

async function isRateLimited(key: string): Promise<boolean> {
  const now = new Date();
  const { data } = await getSupabaseAdmin().from("rate_limits").select("*").eq("key", key).maybeSingle();

  if (!data || now.getTime() - new Date(data.window_start).getTime() > RATE_LIMIT_WINDOW_MS) {
    await getSupabaseAdmin().from("rate_limits").upsert({ key, count: 1, window_start: now.toISOString() });
    return false;
  }

  const newCount = (data.count || 0) + 1;
  await getSupabaseAdmin().from("rate_limits").update({ count: newCount }).eq("key", key);
  return newCount > RATE_LIMIT_MAX;
}

// ---------------------------------------------------------------------------
// 🔧 FIX (Firebase -> Supabase migration): পুরনো ইউজারদের প্রোফাইল (users
// টেবিল) migrate হয়েছে, কিন্তু তাদের পাসওয়ার্ড/অ্যাকাউন্ট Firebase Auth-এ
// ছিল -- Supabase Auth-এ কোনো অ্যাকাউন্ট তৈরি হয়নি। ফলে পুরনো নম্বর দিয়ে
// লগইন করলে সবসময় "ভুল পাসওয়ার্ড অথবা এই নম্বরে কোনো অ্যাকাউন্ট নেই" আসত,
// আর signup করতে গেলেও পুরনো লিস্টিং/চ্যাট হারিয়ে যেত (নতুন uid হতো)।
//
// সমাধান: লগইন ব্যর্থ হলে দেখা হয় users টেবিলে এই নম্বরের পুরনো প্রোফাইল
// আছে কিনা এবং Supabase Auth-এ ওই নম্বরের অ্যাকাউন্ট আদৌ আছে কিনা। পুরনো
// প্রোফাইল আছে অথচ Auth অ্যাকাউন্ট নেই -- মানে এটা migrate হওয়া ইউজার:
// তখন প্রথম লগইনের পাসওয়ার্ড দিয়েই তার Auth অ্যাকাউন্ট বানিয়ে দেওয়া হয়
// (one-time claim) এবং তার পুরনো uid-ই ফেরত দেওয়া হয়, যাতে আগের সব
// listing, chat আর dashboard আগের মতোই থাকে।
// ---------------------------------------------------------------------------
function phoneVariants(intlPhone: string): string[] {
  const local = intlPhone.replace("+880", "");
  return [intlPhone, `880${local}`, `0${local}`, local];
}

async function findLegacyProfile(intlPhone: string): Promise<{ uid: string } | null> {
  // First try the common stored formats. Older Firebase exports sometimes
  // contain spaces, dashes, Bangla digits, or a leading +880, so an exact
  // `in(...)` query alone can miss the migrated profile and create a second
  // application account.
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("uid, phone, created_at")
    .in("phone", phoneVariants(intlPhone))
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("legacy profile lookup failed:", error.message);
  } else if (data && data[0]) {
    return { uid: data[0].uid };
  }

  // Fallback to canonical comparison so formatting differences from the
  // Firebase migration cannot make an old user look like a new user.
  const { data: candidates, error: fallbackError } = await supabaseAdmin
    .from("users")
    .select("uid, phone, created_at")
    .not("phone", "is", null)
    .order("created_at", { ascending: true });
  if (fallbackError) {
    console.error("legacy profile fallback lookup failed:", fallbackError.message);
    return null;
  }

  const match = (candidates || []).find((candidate: any) => normalizeBanglaPhone(candidate.phone) === intlPhone);
  return match ? { uid: match.uid } : null;
}

/** লগইন করা Auth ইউজারের জন্য অ্যাপের আসল uid (পুরনো হলে legacy uid)। */
async function resolveAppUid(authUserId: string, intlPhone: string): Promise<string> {
  const legacy = await findLegacyProfile(intlPhone);
  return legacy?.uid || authUserId;
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

  const legacy = await findLegacyProfile(phone);
  const { error: createError } = await getSupabaseAdmin().auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });

  if (createError) {
    if (createError.status === 422 || /already.*registered|already.*exists/i.test(createError.message || "")) {
      // The user may have reached this form after an earlier failed attempt.
      // If Auth was created but the old profile still exists, sign into that
      // Auth account and return the legacy app uid instead of treating it as a
      // brand-new application account.
      if (legacy) {
        const { data: existingSession, error: existingSignInError } =
          await getSupabaseAdmin().auth.signInWithPassword({ phone, password });
        if (!existingSignInError && existingSession.session) {
          return res.status(200).json({
            access_token: existingSession.session.access_token,
            refresh_token: existingSession.session.refresh_token,
            uid: legacy.uid,
            auth_uid: existingSession.user.id,
            phone,
            claimed: true,
          });
        }
      }
      return res.status(409).json({
        error: "এই নম্বরে আগে থেকেই অ্যাকাউন্ট আছে। লগইন করুন।",
        code: "ALREADY_REGISTERED",
      });
    }
    throw createError;
  }

  const { data: sessionData, error: signInError } = await getSupabaseAdmin().auth.signInWithPassword({ phone, password });
  if (signInError || !sessionData.session) throw signInError || new Error("no session after signup");

  // এই নম্বরের পুরনো (migrate হওয়া) প্রোফাইল থাক��ে সেটার uid-ই রাখা হয়,
  // নইলে ওই ইউজারের পুরনো listing/chat নতুন অ্যাকাউন্টে দেখা যেত না।
  const appUid = legacy?.uid || (await resolveAppUid(sessionData.user.id, phone));

  await getSupabaseAdmin().from("users").upsert(
    { uid: appUid, phone, created_at: new Date().toISOString() },
    { onConflict: "uid" }
  );

  return res.status(200).json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    uid: appUid,
    auth_uid: sessionData.user.id,
    phone,
  });
}

async function handleLogin(req: any, res: any) {
  const phone = normalizeBanglaPhone(req.body?.phone);
  const password = String(req.body?.password || "");

  if (!phone || !password) {
    return res.status(400).json({ error: "মোবাইল নম্বর ও পাসওয়ার্ড দিন।" });
  }

  const { data: lockRow } = await supabaseAdmin
    .from("login_lockouts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  const now = Date.now();
  if (lockRow?.lock_until && now < new Date(lockRow.lock_until).getTime()) {
    const waitMin = Math.ceil((new Date(lockRow.lock_until).getTime() - now) / 60000);
    return res.status(429).json({
      error: `অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। ${waitMin} মিনিট পর আবার চেষ্টা করুন।`,
    });
  }

  const { data: sessionData, error } = await getSupabaseAdmin().auth.signInWithPassword({ phone, password });

  if (error) {
    const failedAttempts = (lockRow?.failed_attempts || 0) + 1;
    const update: any = { phone, failed_attempts: failedAttempts, updated_at: new Date().toISOString() };
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      update.lock_until = new Date(now + LOCK_DURATION_MS).toISOString();
      update.failed_attempts = 0;
    }
    await getSupabaseAdmin().from("login_lockouts").upsert(update, { onConflict: "phone" });

    if (/invalid login credentials/i.test(error.message || "")) {
      // migrate হওয়া পুরনো ইউজার কিনা দেখা হচ্ছে (উপরের কমেন্ট দেখুন)।
      const legacy = await findLegacyProfile(phone);
      if (legacy) {
        if (password.length < 8) {
          return res.status(400).json({
            error: "আপনার পুরনো অ্যাকাউন্ট নতুন সিস্টেমে এসেছে। এখন কমপক্ষে ৮ ক্যারেক্টারের একটি নতুন পাসওয়ার্ড দিন — সেটাই আপনার পাসওয়ার্ড হয়ে যাবে।",
            code: "LEGACY_SET_PASSWORD",
          });
        }
        const { data: created, error: createError } = await getSupabaseAdmin().auth.admin.createUser({
          phone,
          password,
          phone_confirm: true,
        });
        if (!createError && created?.user) {
          const { data: claimedSession, error: claimSignInError } =
            await getSupabaseAdmin().auth.signInWithPassword({ phone, password });
          if (!claimSignInError && claimedSession?.session) {
            await supabaseAdmin
              .from("login_lockouts")
              .update({ failed_attempts: 0, lock_until: null })
              .eq("phone", phone);
            return res.status(200).json({
              access_token: claimedSession.session.access_token,
              refresh_token: claimedSession.session.refresh_token,
              uid: legacy.uid,
              auth_uid: claimedSession.user.id,
              phone,
              claimed: true,
            });
          }
        }
        // createUser ব্যর্থ মানে Auth অ্যাকাউন্ট আসলে আগে থেকেই আছে ->
        // অর্থাৎ সত্যিই পাসওয়ার্ড ভুল।
      }
      return res.status(400).json({ error: "ভুল পাসওয়ার্ড অথবা এই নম্বরে কোনো অ্যাকাউন্ট নেই।" });
    }
    throw error;
  }

  if (lockRow?.failed_attempts || lockRow?.lock_until) {
    await getSupabaseAdmin().from("login_lockouts").update({ failed_attempts: 0, lock_until: null }).eq("phone", phone);
  }

  const appUid = await resolveAppUid(sessionData.user!.id, phone);

  return res.status(200).json({
    access_token: sessionData.session!.access_token,
    refresh_token: sessionData.session!.refresh_token,
    uid: appUid,
    auth_uid: sessionData.user!.id,
    phone,
  });
}

export default async function handler(req: any, res: any) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const clientIp = getClientIp(req);
    if (await isRateLimited(clientIp)) {
      return res.status(429).json({ error: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
    }

    const action = req.body?.action;
    if (action === "signup") return await handleSignup(req, res);
    if (action === "login") return await handleLogin(req, res);
    return res.status(400).json({ error: "Invalid action." });
  } catch (err: any) {
    console.error("phone auth failed:", err);
    return res.status(500).json({ error: "অনুরোধটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" });
  }
}
