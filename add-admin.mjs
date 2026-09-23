// add-admin.mjs
// GariBazar admin-e কাউকে যোগ করার script (Supabase-based, Firebase না)
//
// ব্যবহার:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_UID=... node add-admin.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_UID = process.env.ADMIN_UID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
  process.exit(1);
}
if (!ADMIN_UID) {
  console.error("❌ ADMIN_UID missing. যে ইউজারকে admin বানাতে চান তার uid দিন।");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const { data: userRow, error: userErr } = await supabase
  .from("users")
  .select("uid, name, phone")
  .eq("uid", ADMIN_UID)
  .maybeSingle();

if (userErr) {
  console.error("❌ users টেবিল চেক করতে সমস্যা:", userErr.message);
  process.exit(1);
}
if (!userRow) {
  console.error(`❌ এই uid দিয়ে কোনো user পাওয়া যায়নি: ${ADMIN_UID}`);
  process.exit(1);
}

const { error: insertErr } = await supabase
  .from("admins")
  .upsert({ uid: ADMIN_UID }, { onConflict: "uid" });

if (insertErr) {
  console.error("❌ admin insert ব্যর্থ:", insertErr.message);
  process.exit(1);
}

console.log(`✅ Admin যোগ হয়েছে: ${userRow.name || userRow.phone} (${ADMIN_UID})`);
