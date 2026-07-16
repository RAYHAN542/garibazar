import os

changed_parts = []

path = "src/components/MarketplaceTab.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_imports = '''import { Search, SlidersHorizontal, Bell, Check, Plus, X, ShoppingBag, Loader2 } from "lucide-react";
import { ListingCard } from "./ListingCard";
import { PromotedSlider } from "./PromotedSlider";
import { CITIES } from "../translations";
import { PartListing, SupportedLanguage, TranslationSet } from "../types";
import type { ActiveTab } from "./HeaderNav";'''

new_imports = '''import { Search, SlidersHorizontal, Bell, Check, Plus, X, ShoppingBag, Loader2 } from "lucide-react";
import { ListingCard } from "./ListingCard";
import { PromotedSlider } from "./PromotedSlider";
import { CITIES } from "../translations";
import { PartListing, SupportedLanguage, TranslationSet } from "../types";
import type { ActiveTab } from "./HeaderNav";
import { logAnalyticsEvent } from "../firebase";
import vehicleCardImg from "../assets/images/vehicle-card-new.png";
import partsCardImg from "../assets/images/parts-card-new.png";'''

if "import vehicleCardImg" in content and "import partsCardImg" in content and "logAnalyticsEvent } from \"../firebase\"" in content:
    changed_parts.append("already-patched")
elif old_imports in content:
    content = content.replace(old_imports, new_imports, 1)
    changed_parts.append("imports-added")
else:
    print("[WARN] expected import block not found in src/components/MarketplaceTab.tsx — check manually")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("=== fix_marketplacetab_missing_imports.py রেজাল্ট ===")
print("Patched sections:", changed_parts)

if "imports-added" in changed_parts or "already-patched" in changed_parts:
    print("[OK] vehicleCardImg, partsCardImg, logAnalyticsEvent — এই ৩টা missing import যোগ হয়েছে।")
else:
    print("[PARTIAL] ম্যানুয়ালি src/components/MarketplaceTab.tsx-এর উপরের import অংশ চেক করুন।")
