path = "src/components/AdminPanel.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

changed_parts = []

# 1. Add dedicated real-time full listings listener for admin (independent of Market pagination)
old1 = '''export function AdminPanel({ language, currentUser, listings: listingsProp, isUserAdmin }: AdminPanelProps) {
  // Local mirror of the listings prop so we can optimistically remove
  // deleted items instantly without waiting for a full page reload.
  const [listings, setListings] = useState<any[]>(listingsProp);
  useEffect(() => {
    setListings(listingsProp);
  }, [listingsProp]);'''
new1 = '''export function AdminPanel({ language, currentUser, listings: listingsProp, isUserAdmin }: AdminPanelProps) {
  // Local mirror of the listings prop so we can optimistically remove
  // deleted items instantly without waiting for a full page reload.
  const [listings, setListings] = useState<any[]>(listingsProp);
  useEffect(() => {
    setListings(listingsProp);
  }, [listingsProp]);

  // Admin needs the REAL, complete count/list of every listing in the database —
  // not just whatever the Market page happens to have paginated in via "Load More".
  // This is a dedicated, independent real-time listener so it's always accurate.
  const [adminListings, setAdminListings] = useState<any[]>([]);
  useEffect(() => {
    const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all: any[] = [];
      snapshot.forEach((docSnap) => {
        all.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAdminListings(all);
    }, (err) => {
      console.error("Could not fetch full listings count for admin:", err);
    });
    return () => unsubscribe();
  }, []);'''
if old1 in content:
    content = content.replace(old1, new1, 1)
    changed_parts.append("listener")

# 2. Real total count
old2 = "  const totalListings = listings?.length || 0;"
new2 = "  const totalListings = adminListings?.length || 0;"
if old2 in content:
    content = content.replace(old2, new2, 1)
    changed_parts.append("count")

# 3. Reported filter label
old3 = '''                    ? `অভিযোগ প্রাপ্ত বিজ্ঞাপন (${listings.filter(i => (i.reportCount || 0) > 0).length})` 
                    : `Reported Only (${listings.filter(i => (i.reportCount || 0) > 0).length})`}'''
new3 = '''                    ? `অভিযোগ প্রাপ্ত বিজ্ঞাপন (${adminListings.filter(i => (i.reportCount || 0) > 0).length})` 
                    : `Reported Only (${adminListings.filter(i => (i.reportCount || 0) > 0).length})`}'''
if old3 in content:
    content = content.replace(old3, new3, 1)
    changed_parts.append("reported-label")

# 4. Manage listings grid data source
old4 = "            let filtered = listings.filter(item => "
new4 = "            let filtered = adminListings.filter(item => "
if old4 in content:
    content = content.replace(old4, new4, 1)
    changed_parts.append("grid-source")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

expected = {"listener", "count", "reported-label", "grid-source"}
got = set(changed_parts)
if got == expected:
    print("[OK] AdminPanel.tsx: patched (Manage Listings now shows REAL total count, independent of Market page pagination)")
else:
    print(f"[PARTIAL] এই অংশগুলো প্যাচ হয়নি: {expected - got} — ম্যানুয়ালি চেক করো।")
