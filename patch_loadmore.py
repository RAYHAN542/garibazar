#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: "Load More" চাপলে category-filter (Parts/Vehicles) অনুযায়ী পর্যাপ্ত নতুন
পোস্ট না দেখানোর সমস্যা ঠিক করা হচ্ছে। আগে প্রতি ক্লিকে Firestore থেকে next ২০টা
(সব ক্যাটাগরি মিশানো) আনা হতো, তারপর সেখান থেকে বাছাই হতো -- তাই Parts ট্যাবে
২০টার ভেতর মাত্র ১টা part থাকলে ইউজার শুধু ১টাই নতুন পোস্ট দেখতো। এখন এক ট্যাপে
প্রয়োজনমতো একাধিক ব্যাচ (auto-loop) আনা হবে, যতক্ষণ না বর্তমান ফিল্টারে অন্তত
৬টা নতুন মিলে যাওয়া পোস্ট পাওয়া যায় (বা আর কিছু বাকি না থাকে)।
এই স্ক্রিপ্ট রিপো রুট থেকে চালাও: python3 patch_loadmore.py
"""
import os
import sys

REPO_ROOT = os.getcwd()
APP_PATH = os.path.join(REPO_ROOT, "src", "App.tsx")

OLD_BLOCK = "  // 2c. Listings Pagination Loader helper\n  const handleLoadMoreListings = async () => {\n    if (!lastListingDoc || loadingMoreListings) return;\n    setLoadingMoreListings(true);\n    try {\n      const q = query(\n        collection(db, \"listings\"),\n        orderBy(\"createdAt\", \"desc\"),\n        startAfter(lastListingDoc),\n        limit(20)\n      );\n      const snapshot = await getDocs(q);\n      if (snapshot.empty) {\n        setHasMoreListings(false);\n      } else {\n        const nextList: PartListing[] = [];\n        snapshot.forEach((doc) => {\n          const data = doc.data();\n          const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === \"function\"\n            ? data.createdAt.toDate().toISOString()\n            : data.createdAt;\n          nextList.push({ id: doc.id, ...data, createdAt: normalizedCreatedAt } as PartListing);\n        });\n        \n        setMoreListings(prev => {\n          const combined = [...prev];\n          nextList.forEach(item => {\n            if (!combined.some(existing => existing.id === item.id)) {\n              combined.push(item);\n            }\n          });\n          return combined;\n        });\n        setLastListingDoc(snapshot.docs[snapshot.docs.length - 1]);\n        setHasMoreListings(snapshot.docs.length === 20);\n      }\n    } catch (err) {\n      console.warn(\"Failed to load more listings:\", err);\n    } finally {\n      setLoadingMoreListings(false);\n    }\n  };\n"

NEW_BLOCK = "  // 2c. Listings Pagination Loader helper\n  // NOTE: Firestore pagination fetches the next 20 listings of ANY category\n  // (vehicles + parts mixed), but the visible list is filtered client-side by\n  // whichever tab (selectedCategory) the person is on. That mismatch is why\n  // \"Load More\" used to feel broken -- e.g. on the Parts tab, if only 1 of\n  // the next 20 raw docs happened to be a part, the person would see just 1\n  // new item and have to tap Load More again and again. Fixed by looping:\n  // keep pulling batches until enough *matching* items have been collected\n  // (or there's nothing left to fetch), so one tap reliably surfaces a\n  // meaningful number of new items for whatever filter is active.\n  const handleLoadMoreListings = async () => {\n    if (!lastListingDoc || loadingMoreListings) return;\n    setLoadingMoreListings(true);\n\n    const TARGET_NEW_MATCHES = 6;\n    const MAX_BATCHES = 6; // safety cap: at most 6*20 = 120 extra reads per tap\n\n    const matchesCurrentFilter = (item: PartListing): boolean => {\n      const isVehicle = isItemVehicle(item);\n      if (selectedCategory === \"vehicles\") return isVehicle;\n      if (selectedCategory === \"spare_parts\") return !isVehicle;\n      return true;\n    };\n\n    try {\n      let cursor = lastListingDoc;\n      let combinedNew: PartListing[] = [];\n      let matchedCount = 0;\n      let exhausted = false;\n\n      for (let i = 0; i < MAX_BATCHES; i++) {\n        const q = query(\n          collection(db, \"listings\"),\n          orderBy(\"createdAt\", \"desc\"),\n          startAfter(cursor),\n          limit(20)\n        );\n        const snapshot = await getDocs(q);\n\n        if (snapshot.empty) {\n          exhausted = true;\n          break;\n        }\n\n        const nextList: PartListing[] = [];\n        snapshot.forEach((doc) => {\n          const data = doc.data();\n          const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === \"function\"\n            ? data.createdAt.toDate().toISOString()\n            : data.createdAt;\n          nextList.push({ id: doc.id, ...data, createdAt: normalizedCreatedAt } as PartListing);\n        });\n\n        combinedNew = combinedNew.concat(nextList);\n        matchedCount += nextList.filter(matchesCurrentFilter).length;\n        cursor = snapshot.docs[snapshot.docs.length - 1];\n\n        if (snapshot.docs.length < 20) {\n          exhausted = true;\n          break;\n        }\n        if (matchedCount >= TARGET_NEW_MATCHES) {\n          break;\n        }\n      }\n\n      setMoreListings(prev => {\n        const combined = [...prev];\n        combinedNew.forEach(item => {\n          if (!combined.some(existing => existing.id === item.id)) {\n            combined.push(item);\n          }\n        });\n        return combined;\n      });\n      setLastListingDoc(cursor);\n      setHasMoreListings(!exhausted);\n    } catch (err) {\n      console.warn(\"Failed to load more listings:\", err);\n    } finally {\n      setLoadingMoreListings(false);\n    }\n  };\n"

def main():
    if not os.path.exists(APP_PATH):
        print("ERROR: src/App.tsx পাওয়া যায়নি")
        sys.exit(1)
    with open(APP_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if "MAX_BATCHES" in content and "handleLoadMoreListings" in content:
        print("SKIP: App.tsx-এ Load More fix ইতিমধ্যে patched")
        return

    if OLD_BLOCK not in content:
        print("ERROR: expected handleLoadMoreListings ব্লক খুঁজে পাওয়া যায়নি, ম্যানুয়ালি চেক করো")
        sys.exit(1)

    content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
    with open(APP_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: src/App.tsx patched (Load More fix)")

if __name__ == "__main__":
    main()
    print("\nসম্পন্ন! এখন:")
    print("  git add src/App.tsx")
    print('  git commit -m "fix: Load More now fetches enough matching items per category filter"')
    print("  git push")
