import * as fs from 'fs';

const appPath = 'src/App.tsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

const startIndex = 2365;
let endIndex = -1;

for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes("            {activeTab === 'chats' && (")) {
    endIndex = i;
    break;
  }
}

if (endIndex !== -1) {
  let dashboardContent = lines.slice(startIndex, endIndex).join('\n');
  
  let importsCode = "import { useState, lazy, Suspense } from 'react';\nimport { ShoppingBag, Star, LayoutDashboard, Search, Eye, Sparkles, MapPin, Loader2, CheckCircle2, ChevronRight, Zap, Coins, Copy, Trash2, Heart, Tag, Edit, SquarePen, AlertTriangle } from 'lucide-react';\nimport { db } from '../firebase';\nimport { collection, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, getDoc } from 'firebase/firestore';\nimport { ListingCard } from './ListingCard';\nimport { AD_PACKAGES } from '../translations';\n";
  importsCode += "const AdminPanel = lazy(() => import('./AdminPanel').then(module => ({ default: module.AdminPanel })));\n";
  importsCode += "const PlayStoreDiagnostics = lazy(() => import('./PlayStoreDiagnostics').then(module => ({ default: module.PlayStoreDiagnostics })));\n";
  importsCode += "const SellerAnalyticsGraph = lazy(() => import('./SellerAnalyticsGraph'));\n";

  const componentTemplate = importsCode + `
export function DashboardTab({ 
  user, 
  userMetadata,
  language,
  listings,
  purchases,
  handleDeleteListing,
  setPromotingListing,
  setEditingListing,
  setIsRefillModalOpen,
  setActiveTab
}: any) {
  const [dashboardSubTab, setDashboardSubTab] = useState<'inventory' | 'ads' | 'admin' | 'playstore-audit' | 'my-shop'>('inventory');
  const [currentUserReviews, setCurrentUserReviews] = useState<any[]>([]);
  const [currentUserReviewsLoading, setCurrentUserReviewsLoading] = useState(false);
  const [selectedPromoPkg, setSelectedPromoPkg] = useState<any>(AD_PACKAGES[1]);
  const [adSelectedListingId, setAdSelectedListingId] = useState<string>("");
  const [adPromoLoading, setAdPromoLoading] = useState(false);
  const [adPromoSuccess, setAdPromoSuccess] = useState(false);
  const [adPromoError, setAdPromoError] = useState("");
  const [adPayMode, setAdPayMode] = useState<"instant" | "manual">("instant");
  const [isAdPortalOpen, setIsAdPortalOpen] = useState(false);
  const [adSenderNumber, setAdSenderNumber] = useState("");
  const [adTransactionId, setAdTransactionId] = useState("");
  const [adPaymentMethod, setAdPaymentMethod] = useState<"bKash" | "Nagad" | "Rocket">("bKash");
  const [adPaymentCopied, setAdPaymentCopied] = useState(false);
  const [ownerPaymentInfo, setOwnerPaymentInfo] = useState({ bKash: "01700000000", nagad: "01700000000" });
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  return (
` + dashboardContent + `
  );
}
`;

  fs.writeFileSync('src/components/DashboardTab.tsx', componentTemplate);
  console.log('DashboardTab created successfully.');
}
