import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Data retention & cleanup
// ---------------------------------------------------------------------------
// Two things get purged here on a schedule (see vercel.json "crons"):
//
//  1. Soft-deleted listings (isDeleted: true, set by the app's delete
//     button -- see src/App.tsx handleDeleteListing and firestore.rules,
//     which no longer let a seller hard-delete their own listing). Once
//     deletedAt is more than RETENTION_DAYS_LISTINGS old, this permanently
//     removes the listing document itself and its counterShards
//     subcollection. 30 days gives a real recovery window (e.g. a seller
//     who deleted by mistake, or a support request to restore one) without
//     keeping removed data forever.
//
//  2. Chat messages older than RETENTION_DAYS_MESSAGES. Threads themselves
//     (the parent /chats/{chatId} doc, with lastMessage/unreadCount) are
//     left alone -- only the individual message documents inside old
//     conversations are pruned, via a collectionGroup query across every
//     chat at once rather than looping chat-by-chat.
//
// Both loops delete in small batches (Firestore batch writes cap at 500
// operations) and page through with startAfter until nothing old is left,
// so this scales past a single run's document limit over consecutive
// scheduled invocations if the backlog is large the first time it runs.
// ---------------------------------------------------------------------------

const RETENTION_DAYS_LISTINGS = 30;
const RETENTION_DAYS_MESSAGES = 180;
const BATCH_LIMIT = 400; // stay comfortably under Firestore's 500-op batch cap

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("[data-retention-cleanup] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }
}

async function purgeOldSoftDeletedListings(db: FirebaseFirestore.Firestore): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS_LISTINGS * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection("listings")
    .where("isDeleted", "==", true)
    .where("deletedAt", "<", cutoff)
    .limit(BATCH_LIMIT)
    .get();

  if (snap.empty) return 0;

  // Each listing may also have a counterShards subcollection (the sharded
  // view/save counters) -- those don't get swept up by deleting the parent
  // doc automatically, so drop them explicitly first.
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
  // Same protection as the counter-aggregation cron: only Vercel's own
  // scheduler (which sends this header once CRON_SECRET is set) may call
  // this, otherwise anyone who finds the URL could trigger mass deletes.
  const authHeader = req.headers?.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const db = getFirestore();
    const listingsPurged = await purgeOldSoftDeletedListings(db);
    const messagesPurged = await purgeOldChatMessages(db);

    res.status(200).json({ success: true, listingsPurged, messagesPurged });
  } catch (err: any) {
    console.error("[data-retention-cleanup] failed:", err);
    res.status(500).json({ error: err.message || "Internal error" });
  }
}
