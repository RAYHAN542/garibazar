#!/usr/bin/env python3
"""
Fix: purchases onSnapshot listener was reading the last 20 purchase docs
from the WHOLE collection for every logged-in user, then filtering
client-side. This patch makes it query only the user's own docs
(buyerId / sellerContact), cutting Firestore reads drastically.

Run from the repo root (where src/App.tsx lives):
    python3 fix_purchases_reads.py
"""

import re
import sys
from pathlib import Path

FILE = Path("src/App.tsx")

OLD = '''  // 3. Real-time Purchases Sync (capped to 20 documents)
  useEffect(() => {
    if (!user) {
      setFirebasePurchases([]);
      setMorePurchases([]);
      setLastPurchasesDoc(null);
      setHasMorePurchases(false);
      return;
    }

    const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setFirebasePurchases([]);
        setLastPurchasesDoc(null);
        setHasMorePurchases(false);
      } else {
        const firestoreList: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.buyerId === user.uid || data.sellerContact === userMetadata?.phoneNumber) {
            firestoreList.push({ id: doc.id, ...data });
          }
        });

        setFirebasePurchases(firestoreList);
        setLastPurchasesDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMorePurchases(snapshot.docs.length === 20);
      }
    }, (err) => {
      console.warn("Using offline purchases:", err);
    });

    return () => {
      unsubscribe();
    };
  }, [user, userMetadata?.phoneNumber]);'''

NEW = '''  // 3. Real-time Purchases Sync (filtered by buyerId/sellerContact — avoids reading every user's purchases)
  const lastBuyerDocRef = useRef<DocumentSnapshot | null>(null);
  const lastSellerDocRef = useRef<DocumentSnapshot | null>(null);
  useEffect(() => {
    if (!user) {
      setFirebasePurchases([]);
      setMorePurchases([]);
      setLastPurchasesDoc(null);
      setHasMorePurchases(false);
      lastBuyerDocRef.current = null;
      lastSellerDocRef.current = null;
      return;
    }

    let buyerDocs: any[] = [];
    let sellerDocs: any[] = [];
    let buyerHasMore = false;
    let sellerHasMore = false;

    const mergeAndSet = () => {
      const map = new Map<string, any>();
      [...buyerDocs, ...sellerDocs].forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values());
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFirebasePurchases(merged);
      setHasMorePurchases(buyerHasMore || sellerHasMore);
    };

    const buyerQuery = query(
      collection(db, "purchases"),
      where("buyerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubBuyer = onSnapshot(buyerQuery, (snapshot) => {
      buyerDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      lastBuyerDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
      buyerHasMore = snapshot.docs.length === 20;
      mergeAndSet();
    }, (err) => {
      console.warn("Using offline buyer purchases:", err.message);
    });

    let unsubSeller = () => {};
    if (userMetadata?.phoneNumber) {
      const sellerQuery = query(
        collection(db, "purchases"),
        where("sellerContact", "==", userMetadata.phoneNumber),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      unsubSeller = onSnapshot(sellerQuery, (snapshot) => {
        sellerDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        lastSellerDocRef.current = snapshot.docs[snapshot.docs.length - 1] || null;
        sellerHasMore = snapshot.docs.length === 20;
        mergeAndSet();
      }, (err) => {
        console.warn("Using offline seller purchases:", err.message);
      });
    }

    return () => {
      unsubBuyer();
      unsubSeller();
    };
  }, [user, userMetadata?.phoneNumber]);'''

OLD2 = '''  // 3c. Purchases Pagination Loader helper
  const handleLoadMorePurchases = async () => {
    if (!user || !lastPurchasesDoc || loadingMorePurchases) return;
    setLoadingMorePurchases(true);
    try {
      const q = query(
        collection(db, "purchases"),
        orderBy("createdAt", "desc"),
        startAfter(lastPurchasesDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setHasMorePurchases(false);
      } else {
        const nextList: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.buyerId === user.uid || data.sellerContact === userMetadata?.phoneNumber) {
            nextList.push({ id: doc.id, ...data });
          }
        });

        setMorePurchases(prev => {
          const combined = [...prev];
          nextList.forEach(item => {
            if (!combined.some(existing => existing.id === item.id)) {
              combined.push(item);
            }
          });
          return combined;
        });

        setLastPurchasesDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMorePurchases(snapshot.docs.length === 20);
      }
    } catch (err) {
      console.warn("Failed to load more purchases:", err);
    } finally {
      setLoadingMorePurchases(false);
    }
  };'''

NEW2 = '''  // 3c. Purchases Pagination Loader helper (buyer + seller, filtered)
  const handleLoadMorePurchases = async () => {
    if (!user || (!lastBuyerDocRef.current && !lastSellerDocRef.current) || loadingMorePurchases) return;
    setLoadingMorePurchases(true);
    try {
      const nextList: any[] = [];
      let stillMore = false;

      if (lastBuyerDocRef.current) {
        const buyerQ = query(
          collection(db, "purchases"),
          where("buyerId", "==", user.uid),
          orderBy("createdAt", "desc"),
          startAfter(lastBuyerDocRef.current),
          limit(20)
        );
        const buyerSnap = await getDocs(buyerQ);
        buyerSnap.docs.forEach((doc) => nextList.push({ id: doc.id, ...doc.data() }));
        lastBuyerDocRef.current = buyerSnap.docs[buyerSnap.docs.length - 1] || null;
        if (buyerSnap.docs.length === 20) stillMore = true;
      }

      if (userMetadata?.phoneNumber && lastSellerDocRef.current) {
        const sellerQ = query(
          collection(db, "purchases"),
          where("sellerContact", "==", userMetadata.phoneNumber),
          orderBy("createdAt", "desc"),
          startAfter(lastSellerDocRef.current),
          limit(20)
        );
        const sellerSnap = await getDocs(sellerQ);
        sellerSnap.docs.forEach((doc) => nextList.push({ id: doc.id, ...doc.data() }));
        lastSellerDocRef.current = sellerSnap.docs[sellerSnap.docs.length - 1] || null;
        if (sellerSnap.docs.length === 20) stillMore = true;
      }

      setMorePurchases(prev => {
        const combined = [...prev];
        nextList.forEach(item => {
          if (!combined.some(existing => existing.id === item.id)) {
            combined.push(item);
          }
        });
        return combined;
      });

      setHasMorePurchases(stillMore);
    } catch (err) {
      console.warn("Failed to load more purchases:", err);
    } finally {
      setLoadingMorePurchases(false);
    }
  };'''


def main():
    if not FILE.exists():
        print(f"ERROR: {FILE} not found. Run this from the repo root (garibazar-main).")
        sys.exit(1)

    content = FILE.read_text(encoding="utf-8")

    for label, old, new in [("real-time listener", OLD, NEW), ("load-more pagination", OLD2, NEW2)]:
        count = content.count(old)
        if count == 0:
            print(f"ERROR: could not find the '{label}' block. File may have changed — aborting, no changes written.")
            sys.exit(1)
        if count > 1:
            print(f"ERROR: '{label}' block matched {count} times (expected 1) — aborting, no changes written.")
            sys.exit(1)
        content = content.replace(old, new, 1)

    backup = FILE.with_suffix(".tsx.bak2")
    backup.write_text(FILE.read_text(encoding="utf-8"), encoding="utf-8")
    FILE.write_text(content, encoding="utf-8")

    print("Patched src/App.tsx successfully.")
    print(f"Backup saved at {backup}")
    print("")
    print("IMPORTANT — Firestore composite indexes needed:")
    print("  1) purchases: buyerId (Asc) + createdAt (Desc)")
    print("  2) purchases: sellerContact (Asc) + createdAt (Desc)")
    print("Open the app after deploying — if these indexes don't exist yet,")
    print("Firebase will log a console error with a direct link to auto-create them.")
    print("Click that link (once per index) and wait ~1-2 min for it to build.")


if __name__ == "__main__":
    main()
