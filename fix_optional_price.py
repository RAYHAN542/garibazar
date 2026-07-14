path1 = "src/components/AddPartForm.tsx"
path2 = "src/components/ListingCard.tsx"

changed_parts = []

# ---- AddPartForm.tsx ----
with open(path1, "r", encoding="utf-8") as f:
    content1 = f.read()

old1a = "    if (!category || !price || !location || !phone) {"
new1a = "    if (!category || !location || !phone) {"
if old1a in content1:
    content1 = content1.replace(old1a, new1a, 1)
    changed_parts.append("validation")

old1b = '''          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {activeTab === "part"
                ? (language === "bn" ? "১. পার্টসের মূল্য (BDT) *" : "1. Part Price (BDT) *")
                : (language === "bn" ? "১. গাড়ির মূল্য (BDT) *" : "1. Vehicle Price (BDT) *")}
            </label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="৳" className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500" required />
          </div>'''
new1b = '''          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {activeTab === "part"
                ? (language === "bn" ? "১. পার্টসের মূল্য (BDT) (ঐচ্ছিক)" : "1. Part Price (BDT) (Optional)")
                : (language === "bn" ? "১. গাড়ির মূল্য (BDT) (ঐচ্ছিক)" : "1. Vehicle Price (BDT) (Optional)")}
            </label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="৳" className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500" />
          </div>'''
if old1b in content1:
    content1 = content1.replace(old1b, new1b, 1)
    changed_parts.append("price-field")

with open(path1, "w", encoding="utf-8") as f:
    f.write(content1)

# ---- ListingCard.tsx ----
with open(path2, "r", encoding="utf-8") as f:
    content2 = f.read()

old2 = '''          <span className="text-sm font-black text-amber-600 dark:text-amber-400 tracking-tight">
            ৳{listing.price.toLocaleString("en-IN")}
          </span>'''
new2 = '''          <span className="text-sm font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {listing.price
              ? `৳${listing.price.toLocaleString("en-IN")}`
              : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}
          </span>'''
if old2 in content2:
    content2 = content2.replace(old2, new2, 1)
    changed_parts.append("price-display")

with open(path2, "w", encoding="utf-8") as f:
    f.write(content2)

expected = {"validation", "price-field", "price-display"}
got = set(changed_parts)
if got == expected:
    print("[OK] AddPartForm.tsx + ListingCard.tsx: patched (price is now optional; empty price shows 'Price on Request')")
else:
    print(f"[PARTIAL] এই অংশগুলো প্যাচ হয়নি: {expected - got} — ম্যানুয়ালি চেক করো।")
