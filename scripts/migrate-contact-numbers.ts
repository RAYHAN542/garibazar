// এক-বারের জন্য চালানোর migration script।
// পুরনো listing গুলোতে contactNumber এখনও মূল doc-এ পাবলিকভাবে বসে আছে
// (নতুন listing গুলো আগে থেকেই listings/{id}/private/contact-এ যাচ্ছে)।
// এই script প্রতিটা পুরনো listing থেকে contactNumber পড়ে private/contact-এ
// কপি করবে, তারপর মূল doc থেকে সেই field মুছে দেবে -- ব্যাচে ব্যাচে, যাতে
// একটা ব্যাচ ফেইল করলেও আগের গুলো নিরাপদ থাকে।
//
// চালানোর আগে: .env-এ FIREBASE_SERVICE_ACCOUNT_KEY থাকতে হবে
// (না থাকলে: vercel env pull .env)
//
// ড্রাই রান (কিছু লিখবে না, শুধু কী হতো দেখাবে):
//   DRY_RUN=1 npx tsx scripts/migrate-contact-numbers.ts
// আসল রান:
//   npx tsx scripts/migrate-contact-numbers.ts

import "dotenv/config";
import fs from "fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  // Vercel-এর "Secret" টাইপ env var কখনো CLI দিয়ে pull করলে আসল ভ্যালু
  // দেয় না (সবসময় [SENSITIVE]) -- তাই সরাসরি ডাউনলোড করা JSON ফাইল থেকে
  // পড়া হচ্ছে। SERVICE_ACCOUNT_FILE=~/storage/downloads/xxx.json দিয়ে
  // path বলে দিন, অথবা env var থাকলে সেটাই ব্যবহার হবে।
  const filePath = process.env.SERVICE_ACCOUNT_FILE;
  const serviceAccountJson = filePath
    ? fs.readFileSync(filePath, "utf8")
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountJson) {
    console.error("Service account পাওয়া যায়নি। SERVICE_ACCOUNT_FILE=path/to/key.json দিয়ে চালান।");
    process.exit(1);
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error("Service account JSON parse করা যায়নি:", e);
    process.exit(1);
  }
}

const db = getFirestore();
const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH_SIZE = 200; // প্রতি listing-এ ২টা করে write (private set + main delete) = ৪০০ ops/ব্যাচ, ৫০০ limit-এর নিচে

async function migrate() {
  console.log(DRY_RUN ? "=== DRY RUN (কিছু লেখা হবে না) ===" : "=== আসল migration চলছে ===");

  const snap = await db.collection("listings").get();
  console.log(`মোট listing: ${snap.size}`);

  const needsMigration = snap.docs.filter((d) => {
    const data = d.data();
    return typeof data.contactNumber === "string" && data.contactNumber.length > 0;
  });
  console.log(`পুরনো (এখনও public field-ওয়ালা) listing: ${needsMigration.length}`);

  if (needsMigration.length === 0) {
    console.log("কিছু migrate করার নেই, সব ইতিমধ্যে ঠিক আছে।");
    return;
  }

  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < needsMigration.length; i += BATCH_SIZE) {
    const chunk = needsMigration.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      const data = doc.data();
      const sellerId = data.sellerId;
      const contactNumber = data.contactNumber;

      if (!sellerId || !contactNumber) {
        console.warn(`  ⚠ skip ${doc.id}: sellerId বা contactNumber নেই`);
        failed++;
        continue;
      }

      const contactRef = doc.ref.collection("private").doc("contact");
      batch.set(contactRef, { sellerId, contactNumber }, { merge: true });
      batch.update(doc.ref, { contactNumber: FieldValue.delete() });
    }

    if (!DRY_RUN) {
      await batch.commit();
    }
    migrated += chunk.length - (DRY_RUN ? 0 : 0);
    console.log(`  ব্যাচ ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length}টা listing ${DRY_RUN ? "migrate হতো" : "migrate হলো"}`);
  }

  console.log(`\n✅ শেষ। মোট migrate: ${needsMigration.length - failed}, skip/fail: ${failed}`);
  if (DRY_RUN) {
    console.log("এটা dry run ছিল, কিছুই লেখা হয়নি। আসল রান করতে: npx tsx scripts/migrate-contact-numbers.ts");
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration ব্যর্থ:", err);
    process.exit(1);
  });
