// scripts/backfill-listing-contacts.mjs
//
// The original migrate-firestore-to-supabase.mjs copied `listings` and
// `users`, but never touched `listings/{id}/private/contact` - so every
// migrated listing in Supabase is missing its seller's phone number
// (listing_contacts had 1 row instead of the ~489 it needs).
//
// This reads each Firestore listing's private/contact subdoc and inserts
// it into Supabase's listing_contacts, matched to the right listing via
// legacy_firestore_id (which the original migration already set).
//
// Run this in the SAME place/environment you ran the original
// migrate-firestore-to-supabase.mjs (needs the same
// migration-firebase-key.json file and the same env vars):
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-listing-contacts.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL এবং SUPABASE_SERVICE_ROLE_KEY environment variable হিসেবে দিতে হবে।");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync("./migration-firebase-key.json", "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upsertInBatches(table, rows, conflictColumn, batchSize = 200) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictColumn });
    if (error) {
      console.error(`❌ ${table} ব্যাচ ${i}-${i + batch.length} ব্যর্থ:`, error.message);
      throw error;
    }
    console.log(`   ✅ ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log("📥 Supabase থেকে legacy_firestore_id -> Supabase id ম্যাপিং পড়া হচ্ছে...");
  const { data: existingListings, error: listErr } = await supabase
    .from("listings")
    .select("id, legacy_firestore_id, seller_id")
    .not("legacy_firestore_id", "is", null);

  if (listErr) {
    console.error("❌ Supabase থেকে listings পড়তে ব্যর্থ:", listErr.message);
    process.exit(1);
  }

  const firestoreIdToSupabase = new Map();
  for (const row of existingListings) {
    firestoreIdToSupabase.set(row.legacy_firestore_id, { id: row.id, sellerId: row.seller_id });
  }
  console.log(`   ${firestoreIdToSupabase.size}টা migrated listing পাওয়া গেছে।`);

  console.log("\n📥 Firestore থেকে প্রতিটা listing-এর private/contact পড়া হচ্ছে...");
  const contactRows = [];
  let missing = 0;
  let checked = 0;

  for (const [firestoreId, { id: supabaseId, sellerId }] of firestoreIdToSupabase) {
    checked += 1;
    try {
      const snap = await db
        .collection("listings")
        .doc(firestoreId)
        .collection("private")
        .doc("contact")
        .get();

      if (!snap.exists) {
        missing += 1;
        continue;
      }

      const data = snap.data();
      const phone = data?.contactNumber;
      if (!phone) {
        missing += 1;
        continue;
      }

      contactRows.push({
        listing_id: supabaseId,
        seller_id: data?.sellerId || sellerId || null,
        phone,
      });
    } catch (err) {
      console.error(`   ⚠️  ${firestoreId} পড়তে সমস্যা:`, err.message);
      missing += 1;
    }

    if (checked % 50 === 0) {
      console.log(`   ...${checked}/${firestoreIdToSupabase.size} চেক করা হয়েছে`);
    }
  }

  console.log(`\n   ${contactRows.length}টা ফোন নম্বর পাওয়া গেছে, ${missing}টা মিসিং/খালি ছিল।`);

  if (contactRows.length === 0) {
    console.log("লেখার মতো কিছু নেই, শেষ।");
    return;
  }

  console.log("\n📤 Supabase-এ listing_contacts লেখা হচ্ছে...");
  await upsertInBatches("listing_contacts", contactRows, "listing_id");

  console.log("\n✅ ব্যাকফিল সম্পূর্ণ!");
  console.log(`   মোট লেখা হয়েছে: ${contactRows.length}`);
  console.log(`   ফোন নম্বর ছাড়া (পুরনো ডেটাতেই ছিল না): ${missing}`);
}

main().catch((err) => {
  console.error("\n❌ ব্যাকফিল ব্যর্থ:", err);
  process.exit(1);
});
