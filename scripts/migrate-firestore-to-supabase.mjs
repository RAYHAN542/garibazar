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

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return null;
}

async function migrateUsers() {
  console.log("📥 Firestore থেকে users পড়া হচ্ছে...");
  const snap = await db.collection("users").get();
  const rows = [];
  const seenUids = new Set();

  snap.forEach((doc) => {
    const d = doc.data();
    rows.push({
      uid: doc.id,
      name: d.name || d.displayName || null,
      email: d.email || null,
      phone: d.phone || d.phoneNumber || null,
      profile_picture: d.profilePicture || d.photoURL || null,
      created_at: toIso(d.createdAt) || new Date().toISOString(),
    });
    seenUids.add(doc.id);
  });

  console.log(`   ${rows.length} জন ইউজার পাওয়া গেছে।`);
  return { rows, seenUids };
}

async function migrateListings(knownUserUids) {
  console.log("📥 Firestore থেকে listings পড়া হচ্ছে...");
  const snap = await db.collection("listings").get();
  const rows = [];
  const extraUserRows = [];

  snap.forEach((doc) => {
    const d = doc.data();
    const sellerId = d.sellerId || null;

    if (sellerId && !knownUserUids.has(sellerId)) {
      extraUserRows.push({
        uid: sellerId,
        name: d.sellerName || null,
        created_at: new Date().toISOString(),
      });
      knownUserUids.add(sellerId);
    }

    rows.push({
      legacy_firestore_id: doc.id,
      seller_id: sellerId,
      title: d.title || "",
      description: d.description || "",
      price: typeof d.price === "number" ? d.price : 0,
      category: d.category || null,
      sub_category: d.subCategory || null,
      type: d.type || null,
      brand: d.brand || null,
      model: d.model || "",
      location: d.location || null,
      images: d.images || [],
      is_ad: d.isAd === true,
      ad_tier: d.adTier || null,
      ad_expires_at: toIso(d.adExpiresAt),
      views: typeof d.views === "number" ? d.views : 0,
      clicks: typeof d.clicks === "number" ? d.clicks : 0,
      is_deleted: d.isDeleted === true,
      is_sold: d.isSold === true,
      report_count: typeof d.reportCount === "number" ? d.reportCount : 0,
      reported_by: d.reportedBy || [],
      seller_rating: typeof d.sellerRating === "number" ? d.sellerRating : null,
      seller_review_count: typeof d.sellerReviewCount === "number" ? d.sellerReviewCount : 0,
      daily_stats: d.dailyStats || {},
      expires_at: toIso(d.expiresAt),
      seller_name: d.sellerName || null,
      has_video: d.hasVideo === true,
      video_url: d.videoUrl || null,
      created_at: toIso(d.createdAt) || new Date().toISOString(),
    });
  });

  console.log(`   ${rows.length}টা লিস্টিং পাওয়া গেছে (${extraUserRows.length}টা অতিরিক্ত placeholder user সহ)।`);
  return { rows, extraUserRows };
}

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
  const { rows: userRows, seenUids } = await migrateUsers();
  const { rows: listingRows, extraUserRows } = await migrateListings(seenUids);

  const allUserRows = [...userRows, ...extraUserRows];

  console.log("\n📤 Supabase-এ users লেখা হচ্ছে...");
  await upsertInBatches("users", allUserRows, "uid");

  console.log("\n📤 Supabase-এ listings লেখা হচ্ছে...");
  await upsertInBatches("listings", listingRows, "legacy_firestore_id");

  console.log("\n✅ মাইগ্রেশন সম্পূর্ণ!");
  console.log(`   Users: ${allUserRows.length}`);
  console.log(`   Listings: ${listingRows.length}`);
}

main().catch((err) => {
  console.error("\n❌ মাইগ্রেশন ব্যর্থ:", err);
  process.exit(1);
});
