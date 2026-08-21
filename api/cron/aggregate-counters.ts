import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Periodic aggregation for the distributed view/save counters
// (see src/utils/counters.ts for the write side and firestore.rules for the
// security rules on listings/{id}/counterShards/{shardId}).
//
// Every listing's real-time views/saves live spread across several small
// shard documents so no single popular listing's document gets hammered
// with writes. This job runs on a schedule (see vercel.json "crons") and
// *drains* each listing's shards into the listing's own `views` /
// `savedCount` fields, which is what listing cards and detail pages
// actually read -- so normal reads stay a single cheap field read, and the
// displayed count is only ever a few minutes behind real-time.
//
// Both the drain (shard -> 0) and the deposit (listing.views += total) use
// FieldValue.increment() rather than overwriting with a literal number, for
// two reasons:
//  1. increment() is commutative -- if a new view lands on a shard in the
//     split second between us reading its value and committing the reset,
//     that view is NOT lost (increment(-5) on a shard that went 5 -> 6
//     leaves it at 1, correctly keeping the late view instead of zeroing it).
//  2. It preserves whatever historical view count a listing already had
//     before this counter-sharding system existed -- we're always adding to
//     the existing total, never replacing it.
// ---------------------------------------------------------------------------

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("[aggregate-counters] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

export default async function handler(req: any, res: any) {
  // Only Vercel's own scheduler (which sends this header automatically once
  // CRON_SECRET is set as an env var) may trigger this -- otherwise anyone
  // could spam the endpoint and burn through Firestore quota.
  const authHeader = req.headers?.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const db = getFirestore();
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

    res.status(200).json({ success: true, listingsDrained, shardsDrained });
  } catch (err: any) {
    console.error("[aggregate-counters] failed:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
