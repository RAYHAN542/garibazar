path = "src/App.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed = False

# 1. Fix fetchInitialListings
old1 = (
    "        const list: PartListing[] = [];\n"
    "        snapshot.forEach((docSnap) => {\n"
    "          const data = docSnap.data();\n"
    "          const isDemo = docSnap.id.startsWith(\"local-\") || docSnap.id.startsWith(\"temp-\") || docSnap.id.startsWith(\"part-\") || data.isDemo === true;\n"
    "          if (!isProduction || !isDemo) {\n"
    "            list.push({ id: docSnap.id, ...data } as PartListing);\n"
    "          }"
)
new1 = (
    "        const list: PartListing[] = [];\n"
    "        snapshot.forEach((docSnap) => {\n"
    "          const data = docSnap.data();\n"
    "          const isDemo = docSnap.id.startsWith(\"local-\") || docSnap.id.startsWith(\"temp-\") || docSnap.id.startsWith(\"part-\") || data.isDemo === true;\n"
    "          if (!isProduction || !isDemo) {\n"
    "            const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === \"function\"\n"
    "              ? data.createdAt.toDate().toISOString()\n"
    "              : data.createdAt;\n"
    "            list.push({ id: docSnap.id, ...data, createdAt: normalizedCreatedAt } as PartListing);\n"
    "          }"
)
if old1 in content:
    content = content.replace(old1, new1, 1)
    changed = True

# 2. Fix handleLoadMoreListings
old2 = (
    "        const nextList: PartListing[] = [];\n"
    "        snapshot.forEach((doc) => {\n"
    "          nextList.push({ id: doc.id, ...doc.data() } as PartListing);\n"
    "        });"
)
new2 = (
    "        const nextList: PartListing[] = [];\n"
    "        snapshot.forEach((doc) => {\n"
    "          const data = doc.data();\n"
    "          const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === \"function\"\n"
    "            ? data.createdAt.toDate().toISOString()\n"
    "            : data.createdAt;\n"
    "          nextList.push({ id: doc.id, ...data, createdAt: normalizedCreatedAt } as PartListing);\n"
    "        });"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    changed = True

if changed:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] App.tsx: patched (Firestore Timestamp now properly converted to ISO string; fixes notification spam at its root)")
else:
    print("[SKIP] প্যাটার্ন মিলেনি বা আগেই প্যাচ করা আছে — ম্যানুয়ালি চেক করো।")
