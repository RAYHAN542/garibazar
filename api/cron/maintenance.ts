import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("[maintenance] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

async function aggregateCounters(db: FirebaseFirestore.Firestore): Promise<{ listingsDrained: number; shardsDrained: number }> {
  const listingsSnap = await db.collection("listings").select().get();

  let listingsDrained = 0;
  let shardsDrained = 0;

  for (const listingDoc of listingsSnap.docs) {
    const shardsSnap = await listingDoc.ref.collection("counterShards").get();
    if (shardsSnap.empty) continue;

    let totalViews = 0;
    let totalSaved = 0;
    const dirtyShards: { ref: FirebaseFirestore.DocumentReference; views: number; saved: number }[] = [];

    shardsSnap.forEach((shardDoc) => {
      const data = shardDoc.data();
      const shardViews = typeof data.views === "number" ? data.views : 0;
      const shardSaved = typeof data.saved === "number" ? data.saved : 0;
      if (shardViews !== 0 || shardSaved !== 0) {
        totalViews += shardViews;
        totalSaved += shardSaved;
        dirtyShards.push({ ref: shardDoc.ref, views: shardViews, saved: shardSaved });
      }
    });

    if (dirtyShards.length === 0) continue;

    const batch = db.batch();
    const listingUpdate: Record<string, FirebaseFirestore.FieldValue> = {};
    if (totalViews !== 0) listingUpdate.views = FieldValue.increment(totalViews);
    if (totalSaved !== 0) listingUpdate.savedCount = FieldValue.increment(totalSaved);
    batch.update(listingDoc.ref, listingUpdate);

    for (const shard of dirtyShards) {
      const shardUpdate: Record<string, FirebaseFirestore.FieldValue> = {};
      if (shard.views !== 0) shardUpdate.views = FieldValue.increment(-shard.views);
      if (shard.saved !== 0) shardUpdate.saved = FieldValue.increment(-shard.saved);
      batch.update(shard.ref, shardUpdate);
      shardsDrained++;
    }

    await batch.commit();
    listingsDrained++;
  }

  return { listingsDrained, shardsDrained };
}

const RETENTION_DAYS_LISTINGS = 30;
const RETENTION_DAYS_MESSAGES = 180;
const BATCH_LIMIT = 400;

async function purgeOldSoftDeletedListings(db: FirebaseFirestore.Firestore): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS_LISTINGS * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection("listings")
    .where("isDeleted", "==", true)
    .where("deletedAt", "<", cutoff)
    .limit(BATCH_LIMIT)
    .get();

  if (snap.empty) return 0;

  for (const listingDoc of snap.docs) {
    const shardsSnap = await listingDoc.ref.collection("counterShards").get();
    if (!shardsSnap.empty) {
      const shardBatch = db.batch();
      shardsSnap.forEach((s) => shardBatch.delete(s.ref));
      await shardBatch.commit();
    }
  }

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  return snap.size;
}

async function purgeOldChatMessages(db: FirebaseFirestore.Firestore): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS_MESSAGES * 24 * 60 * 60 * 1000);
  const snap = await db
    .collectionGroup("messages")
    .where("createdAt", "<", cutoff)
    .limit(BATCH_LIMIT)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  return snap.size;
}

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const db = getFirestore();

    const { listingsDrained, shardsDrained } = await aggregateCounters(db);
    const listingsPurged = await purgeOldSoftDeletedListings(db);
    const messagesPurged = await purgeOldChatMessages(db);

    res.status(200).json({
      success: true,
      listingsDrained,
      shardsDrained,
      listingsPurged,
      messagesPurged,
    });
  } catch (err: any) {
    console.error("[maintenance] failed:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
