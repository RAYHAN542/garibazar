import { Suspense, lazy } from "react";
import {
  Grid, ShoppingBag, Eye, Sparkles, ShieldAlert, ShieldCheck, Loader2,
  ChevronDown, Cpu, CreditCard, Lock, MapPin, Star, Zap,
} from "lucide-react";
import { ListingCard } from "./ListingCard";
import { AD_PACKAGES } from "../translations";
import { PartListing, SupportedLanguage, TranslationSet } from "../types";
import type { ActiveTab } from "./HeaderNav";

const AdminPanel = lazy(() => import("./AdminPanel").then(m => ({ default: m.AdminPanel })));
const PlayStoreDiagnostics = lazy(() => import("./PlayStoreDiagnostics").then(m => ({ default: m.PlayStoreDiagnostics })));
const SellerAnalyticsGraph = lazy(() => import("./SellerAnalyticsGraph"));

type DashboardSubTab = 'inventory' | 'ads' | 'admin' | 'playstore-audit' | 'my-shop';

interface DashboardTabProps {
  language: SupportedLanguage;
  activeTranslations: TranslationSet;
  setActiveTab: (tab: ActiveTab) => void;
  user: any;
  userMetadata: any;
  isUserAdmin: boolean;
  listings: PartListing[];
  purchases: any[];
  hasMorePurchases: boolean;
  loadingMorePurchases: boolean;
  handleLoadMorePurchases: () => Promise<void>;
  handleDeleteListingBySeller: (itemId: string) => Promise<void>;
  handleViewListingDetails: (listing: PartListing) => Promise<void>;
  setEditingListing: (listing: PartListing | null) => void;
  dashboardSubTab: DashboardSubTab;
  setDashboardSubTab: (tab: DashboardSubTab) => void;
  currentUserReviews: any[];
  currentUserReviewsLoading: boolean;
  selectedPromoPkg: any;
  setSelectedPromoPkg: (pkg: any) => void;
  expandedAdPkgId: string | null;
  setExpandedAdPkgId: (id: string | null) => void;
  adSelectedListingId: string;
  setAdSelectedListingId: (id: string) => void;
  adPromoLoading: boolean;
  adPromoSuccess: boolean;
  setAdPromoSuccess: (v: boolean) => void;
  adPromoError: string;
  setAdPromoError: (v: string) => void;
  handleDashboardPromoSubmit: () => Promise<void>;
}

/**
 * "My Dashboard" tab: stats cards, inventory/ads/admin/my-shop/playstore-audit sub-tabs,
 * order tracking desk. Extracted from App.tsx to keep the root component smaller.
 * Pure presentational component - all state lives in App.tsx and is passed down as props.
 */
export default function DashboardTab({
  language,
  activeTranslations,
  setActiveTab,
  user,
  userMetadata,
  isUserAdmin,
  listings,
  purchases,
  hasMorePurchases,
  loadingMorePurchases,
  handleLoadMorePurchases,
  handleDeleteListingBySeller,
  handleViewListingDetails,
  setEditingListing,
  dashboardSubTab,
  setDashboardSubTab,
  currentUserReviews,
  currentUserReviewsLoading,
  selectedPromoPkg,
  setSelectedPromoPkg,
  expandedAdPkgId,
  setExpandedAdPkgId,
  adSelectedListingId,
  setAdSelectedListingId,
  adPromoLoading,
  adPromoSuccess,
  setAdPromoSuccess,
  adPromoError,
  setAdPromoError,
  handleDashboardPromoSubmit,
}: DashboardTabProps) {
  return (
              <div className="space-y-4 animate-fade-in">

                {/* 2. Marketing Analytics cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center gap-1">
                    <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                      <Grid className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 leading-tight">{activeTranslations.statsActive}</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">{listings.filter(item => item.sellerId === user.uid).length}</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center gap-1">
                    <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 leading-tight">{language === "bn" ? "ক্রুস ট্র্যাক" : "Tracked Orders"}</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">{purchases.filter(item => item.buyerId === user.uid).length}</span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center gap-1">
                    <div className="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg">
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8px] sm:text-[9px] uppercase font-bold text-slate-400 leading-tight">{language === "bn" ? "মার্কেট ভিউস" : "Shop Views"}</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">
                      {listings.filter(item => item.sellerId === user.uid).reduce((sum, current) => sum + (current.views ?? 0), 0)}
                    </span>
                  </div>
                </div>

                {/* Seller Performance Analytics Graph */}
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                  <SellerAnalyticsGraph
                    listings={listings}
                    purchases={purchases}
                    userId={user.uid}
                    language={language}
                  />
                </Suspense>

                {/* Dashboard Tab Toggles — compact pill বাটন, ছোট লেখা, সবগুলো এক স্ক্রিনে ধরার জন্য */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1" id="dash-tabs-bar">
                  <button
                    id="dash-subtab-inventory"
                    onClick={() => {
                      setDashboardSubTab('inventory');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                      dashboardSubTab === 'inventory'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    {language === "bn" ? "প্রোডাক্টস" : "Products"}
                  </button>

                  <button
                    id="dash-subtab-myshop"
                    onClick={() => {
                      setDashboardSubTab('my-shop');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                      dashboardSubTab === 'my-shop'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {language === "bn" ? "দোকান" : "My Shop"}
                  </button>

                  <button
                    id="dash-subtab-ads"
                    onClick={() => {
                      setDashboardSubTab('ads');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer relative shrink-0 whitespace-nowrap ${
                      dashboardSubTab === 'ads'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {language === "bn" ? "বিজ্ঞাপন" : "Ads"}
                    <span className="bg-gradient-to-r from-red-500 to-amber-500 text-white font-extrabold text-[7px] uppercase px-1 py-0.5 rounded-full leading-none">
                      LIVE
                    </span>
                  </button>

                  {isUserAdmin && (
                    <button
                      id="dash-subtab-admin"
                      onClick={() => {
                        setDashboardSubTab('admin');
                      }}
                      className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                        dashboardSubTab === 'admin'
                          ? 'bg-red-500 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {language === "bn" ? "অ্যাডমিন" : "Admin"}
                    </button>
                  )}

                  {isUserAdmin && (
                    <button
                      id="dash-subtab-playstore"
                      onClick={() => {
                        setDashboardSubTab('playstore-audit');
                      }}
                      className={`px-3 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                        dashboardSubTab === 'playstore-audit'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      {language === "bn" ? "প্লে স্টোর" : "Play Store"}
                    </button>
                  )}
                </div>

                {dashboardSubTab === 'inventory' && (
                  /* 3. My Listings list vs Tracks Purchased items split layout */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
                    
                    {/* Left: Listings posted by currently logged in User */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2">
                        {language === "bn" ? "আমার কার পার্টস লিস্টিং" : "My Posted Car Parts"}
                      </h3>

                      {listings.filter(item => item.sellerId === user.uid).length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 p-4 text-center text-slate-500">
                          <p className="text-xs">{language === "bn" ? "আপনি এখনো কোনো প্রোডাক্ট পোস্ট করেননি" : "You have not listed any car parts yet."}</p>
                          <button
                            onClick={() => setActiveTab("sell")}
                            className="mt-3 text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-4 py-2 rounded-lg cursor-pointer"
                          >
                            {language === "bn" ? "প্রথম লিস্টিং পোস্ট করুন" : "Post your first Part"}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {listings.filter(item => item.sellerId === user.uid).map((item) => (
                            <div 
                              key={item.id}
                              className="bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex gap-3.5 items-center justify-between"
                            >
                              <div className="flex gap-3 items-center min-w-0">
                                <img src={item.images && item.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                                <div className="min-w-0">
                                  <h5 className="text-sm font-bold text-slate-850 dark:text-white truncate">{item.title}</h5>
                                  <div className="text-[11px] text-slate-400 mt-0.5 flex gap-2">
                                    <span>{item.price ? `৳${item.price.toLocaleString("en-IN")}` : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}</span>
                                    <span>•</span>
                                    <span>👁️ {item.views || 0} views</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 justify-end">
                                {item.isAd ? (
                                  <span className="text-[9px] uppercase font-bold text-amber-500 border border-amber-500/20 px-2 py-1 rounded bg-amber-500/5 h-fit">
                                    {item.adTier} Ad Live
                                  </span>
                                ) : (
                                  <button
                                    id={`dash-boost-btn-${item.id}`}
                                    onClick={() => {
                                      setDashboardSubTab('ads');
                                      setAdSelectedListingId(item.id);
                                    }}
                                    className="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded transition cursor-pointer"
                                  >
                                    {language === "bn" ? "বিজ্ঞাপন দিন" : "Promote"}
                                  </button>
                                )}

                                <button
                                  onClick={() => handleViewListingDetails(item)}
                                  className="text-[10px] font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-955 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded transition cursor-pointer"
                                >
                                  {language === "bn" ? "দেখুন" : "View"}
                                </button>

                                <button
                                  onClick={() => setEditingListing(item)}
                                  className="text-[10px] font-bold bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 dark:text-indigo-400 hover:text-white px-2.5 py-1.5 rounded transition cursor-pointer"
                                  title={language === "bn" ? "সম্পাদনা" : "Edit Part"}
                                >
                                  {language === "bn" ? "সম্পাদনা" : "Edit"}
                                </button>

                                <button
                                  onClick={() => handleDeleteListingBySeller(item.id)}
                                  className="text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-450 hover:text-white px-2.5 py-1.5 rounded transition cursor-pointer"
                                  title={language === "bn" ? "মুছে ফেলুন" : "Delete"}
                                >
                                  {language === "bn" ? "মুছে ফেলুন" : "Delete"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Simulated Buyer Purchases and Order Tracking Desk */}
                    <div className="space-y-4">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-emerald-500" />
                        {language === "bn" ? "আমার অর্ডার ও ক্রুস ট্র্যাক" : "My Inquiries & Simulated Purchases"}
                      </h4>

                      {purchases.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 p-4 text-center text-slate-500">
                          <p className="text-xs">{language === "bn" ? "কোন অর্ডার বা কেনাকাটার ট্র্যাক ইতিহাস নেই!" : "Empty. Click 'Buy / Order This Part' on any detail card to simulate."}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {purchases.map((item) => (
                            <div 
                              key={item.id}
                  onClick={() => {
                    const realListing = listings.find((l) => l.id === item.listingId);
                    if (realListing) {
                      handleViewListingDetails(realListing);
                    } else {
                      handleViewListingDetails(item);
                    }
                  }}
                              className="bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
                            >
                              <div className="flex gap-3 items-center min-w-0">
                                <img src={item.images && item.images[0] || item.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                                <div className="min-w-0">
                                  <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider block">ID: GBC-{item.id.slice(-5).toUpperCase()}</span>
                                  <h5 className="text-sm font-bold text-slate-850 dark:text-white truncate">{item.title}</h5>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {language === "bn" ? "বিক্রেতা:" : "Seller:"} <span className="font-semibold text-slate-350">{item.sellerName}</span> ({item.sellerContact})
                                  </div>
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-0 border-slate-100 dark:border-slate-850 pt-2 sm:pt-0">
                                <span className="text-xs font-black text-amber-500">{item.price ? `৳${item.price.toLocaleString("en-IN")}` : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 mt-1 flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {item.status || "Pending Delivery"}
                                </span>
                              </div>
                            </div>
                          ))}
                          
                          {hasMorePurchases && (
                            <div className="flex justify-center mt-4 pb-2">
                              <button
                                onClick={handleLoadMorePurchases}
                                disabled={loadingMorePurchases}
                                className="px-5 py-2.5 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-98 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-sm border border-slate-200/50 dark:border-slate-800"
                              >
                                {loadingMorePurchases ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                    <span>{language === "bn" ? "লোড হচ্ছে..." : "Loading..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>{language === "bn" ? "আরো দেখুন" : "Load More"}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {dashboardSubTab === 'my-shop' && (
                  <div className="space-y-6 animate-fade-in" id="dashboard-my-shop-section">
                    
                    {/* Shop profile overview card */}
                    <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-4 relative overflow-hidden shadow-xl">
                      <div className="absolute top-0 right-0 p-8 text-amber-500/5 select-none pointer-events-none">
                        <ShoppingBag className="w-48 h-48" />
                      </div>

                      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 z-10 relative">
                        <div className="flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
                          <img 
                            src={user.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`} 
                            alt={user.displayName}
                            className="w-20 h-20 rounded-full object-cover border-4 border-amber-500/85 shadow-lg shadow-amber-500/10"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
                            }}
                          />
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                              <h4 className="text-xl font-black text-white tracking-tight">
                                {user.displayName || user.email?.split("@")[0] || "Gari Bazar Seller"}
                              </h4>
                              <span className="text-[9px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/35 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                                {language === "bn" ? "ভেরিফাইড শপ" : "Verified Shop"}
                              </span>
                            </div>
                            
                            <div className="text-xs text-slate-400 flex flex-wrap items-center justify-center md:justify-start gap-4">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                {userMetadata?.city || "Dhaka"}
                              </span>
                              <span>•</span>
                              <span className="font-extrabold text-amber-500 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                {currentUserReviews.length > 0 
                                  ? `${(currentUserReviews.reduce((sum, r) => sum + r.rating, 0) / currentUserReviews.length).toFixed(1)} / 5`
                                  : (language === "bn" ? "কোন রেটিং নেই" : "No ratings yet")}
                                {currentUserReviews.length > 0 && ` (${currentUserReviews.length} ${language === "bn" ? "রিভিউ" : "reviews"})`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Metrics Grid */}
                        <div className="flex gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-5 w-full md:w-auto justify-around md:justify-end">
                          <div className="text-center md:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none mb-1.5">
                              {language === "bn" ? "মোট পোস্ট করা লিস্টিং" : "Total Posted"}
                            </span>
                            <span className="text-3xl font-black text-white">
                              {listings.filter(item => item.sellerId === user.uid).length}
                            </span>
                          </div>
                          <div className="text-center md:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none mb-1.5">
                              {language === "bn" ? "সক্রিয় স্টক সংখ্যা" : "Active Items"}
                            </span>
                            <span className="text-3xl font-black text-amber-500">
                              {listings.filter(item => item.sellerId === user.uid && !item.isSold).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Stock Section */}
                    <div className="space-y-4">
                      <h4 className="text-base font-black text-slate-850 dark:text-white tracking-tight border-b border-slate-100 dark:border-slate-850 pb-2.5 flex items-center gap-2">
                        <ShoppingBag className="w-4.5 h-4.5 text-amber-500" />
                        {language === "bn" ? "আমার চলমান পার্টস ও সক্রিয় বিজ্ঞাপন" : "My Active Live Listings"}
                      </h4>

                      {listings.filter(item => item.sellerId === user.uid && !item.isSold).length === 0 ? (
                        <div className="text-center py-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-slate-500 text-xs">
                          {language === "bn" 
                            ? "আপনার কোন সক্রিয় প্রোডাক্ট বা কার পার্টস লিস্টিং নেই! লিস্টিং যোগ করতে 'বিক্রি করুন' ট্যাবে যান।" 
                            : "You don't have any active listings. Go to the 'Sell Part' tab to add items!"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {listings.filter(item => item.sellerId === user.uid && !item.isSold).map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              language={language}
                              isAdmin={true}
                              onViewDetails={handleViewListingDetails}
                              onPromoteClick={() => {}}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reviews list for this seller */}
                    <div className="border-t border-slate-150 dark:border-slate-800 pt-6 space-y-4">
                      <h4 className="text-base font-black text-slate-850 dark:text-white tracking-tight flex items-center gap-2">
                        <Star className="w-4.5 h-4.5 text-rose-500 fill-rose-500" />
                        {language === "bn" ? "আমার কাস্টমার রিভিউ ও ট্রাস্ট রেটিং" : "My Customer Reviews & Trust Ratings"}
                      </h4>

                      {currentUserReviewsLoading ? (
                        <div className="flex justify-center items-center py-6">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                        </div>
                      ) : currentUserReviews.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-955 rounded-xl text-center text-slate-500 text-xs border border-slate-150 dark:border-slate-850">
                          {language === "bn" 
                            ? "এখনো ক্রেতারা আপনাকে কোনো রিভিউ বা ফিডব্যাক দেননি।" 
                            : "No customer reviews yet. Build trust by completing orders and listing quality parts!"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentUserReviews.map((rev) => (
                            <div key={rev.id} className="p-4 bg-slate-50 dark:bg-slate-955 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-slate-800 dark:text-white">{rev.reviewerName}</span>
                                <span className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")}</span>
                              </div>
                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-800"}`} />
                                ))}
                              </div>
                              <p className="text-slate-650 dark:text-slate-450 text-xs italic">"{rev.comment}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {dashboardSubTab === 'ads' && (
                  /* Option B: Live Ad Campaign & Boost Manager Panel */
                  <div className="space-y-5 animate-fade-in" id="ads-campaign-suite">
                    
                    {/* Header Suite Guide */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 text-amber-500/5 select-none pointer-events-none">
                        <Sparkles className="w-36 h-36" />
                      </div>
                      <div className="max-w-xl">
                        <span className="text-amber-500 text-xs font-extrabold tracking-widest uppercase block mb-1">
                          {language === "bn" ? "প্রিমিয়াম বিজ্ঞাপন ও ট্রাফিক বুস্টার" : "PREMIUM ADVERTISING SUITE"}
                        </span>
                        <h4 className="text-lg font-black text-white font-sans tracking-tight">
                          {language === "bn" ? "আপনার স্পেয়ার পার্টসের সেলস ১০ গুণ বৃদ্ধি করুন!" : "Accelerate spare part calls and buyer conversions up to 10x!"}
                        </h4>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                          {language === "bn"
                            ? "সহজ ও নিরাপদ চেকআউটের মাধ্যমে পেমেন্ট করে আপনার যেকোনো কার পার্টস আইটেমকে মার্কেট ফিল্টারে অথবা আমাদের হোমপেইজের টপ স্লাইডারে স্পন্সর করে বুস্ট করান।"
                            : "Pay securely via checkout to sponsor and boost any of your car parts listings — get priority placement or a spot on our homepage top slider."}
                        </p>
                      </div>
                    </div>

                    {/* Step 1: AD Packages side-by-side selective grid */}
                    <div className="space-y-3">
                      <h5 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                        {language === "bn" ? "ধাপ ১: বিজ্ঞাপন প্যাকেজ এবং বুস্ট টিয়ার সিলেক্ট করুন" : "STEP 1: SELECT YOUR SPONSORSHIP TIER"}
                      </h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {AD_PACKAGES.map((pkg) => {
                          const isSelected = selectedPromoPkg?.id === pkg.id;
                          const isExpanded = expandedAdPkgId === pkg.id;
                          return (
                            <div
                              key={pkg.id}
                              className={`rounded-2xl border transition-all relative overflow-hidden ${
                                isSelected
                                  ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/20 text-white shadow-xl"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-slate-355"
                              }`}
                            >
                              {/* Selection Spot decorator */}
                              {isSelected && (
                                <div className="absolute top-4 right-4 bg-amber-500 text-slate-950 p-1 rounded-full scale-90">
                                  <ShieldCheck className="w-4 h-4 fill-slate-950" />
                                </div>
                              )}

                              {/* Accordion header — সবসময় দেখা যাবে, ট্যাপ করলে খুলবে/বন্ধ হবে */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPromoPkg(pkg);
                                  setAdPromoSuccess(false);
                                  setAdPromoError("");
                                  setExpandedAdPkgId(isExpanded ? null : pkg.id);
                                }}
                                className="w-full text-left p-4 flex items-center justify-between gap-2 cursor-pointer"
                              >
                                <div>
                                  <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                    pkg.id === 'pkg-featured' 
                                      ? 'bg-rose-500/15 text-rose-500 border border-rose-500/10'
                                      : pkg.id === 'pkg-premium'
                                      ? 'bg-indigo-505/15 text-indigo-500 border border-indigo-500/10'
                                      : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/10'
                                  }`}>
                                    {language === "bn" ? pkg.nameBn : pkg.nameEn}
                                  </span>
                                  <div className="mt-2 flex items-baseline gap-1">
                                    <span className={`text-xl font-black font-mono transition-colors ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                      ৳{pkg.price.toLocaleString("en-IN")}
                                    </span>
                                    <span className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                                      / {language === "bn" ? `${pkg.durationDays} দিন` : `${pkg.durationDays} days`}
                                    </span>
                                  </div>
                                </div>
                                <ChevronDown className={`w-4.5 h-4.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""} ${isSelected ? "text-slate-300" : "text-slate-400"}`} />
                              </button>

                              {/* Accordion body — শুধু expand করলে দেখাবে */}
                              {isExpanded && (
                                <div className="px-4 pb-4">
                                  <ul className="space-y-2">
                                    {(language === "bn" ? pkg.benefitsBn : pkg.benefitsEn).map((benefit, bIdx) => (
                                      <li key={bIdx} className="flex items-start gap-1.5 leading-tight text-[11px]">
                                        <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                        <span className={`${isSelected ? "text-slate-200" : "text-slate-600 dark:text-slate-350"}`}>
                                          {benefit}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>

                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedPromoPkg(pkg);
                                        setAdPromoSuccess(false);
                                        setAdPromoError("");
                                      }}
                                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                          ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md"
                                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350"
                                      }`}
                                    >
                                      {isSelected 
                                        ? (language === "bn" ? "প্যাকেজটি সিলেক্টেড" : "Selected Tier")
                                        : (language === "bn" ? "প্যাকেজ নির্বাচন করুন" : "Select Tier")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Campaign config wizard form */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                      
                      {/* Left Block: Selector Form */}
                      <div className="lg:col-span-7 space-y-4">
                        <h5 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                          {language === "bn" ? "ধাপ ২: প্রোডাক্ট এবং পেমেন্ট ডিটেইলস দিন" : "STEP 2: CHOOSE ITEM & PAYMENT DETAILS"}
                        </h5>

                        <div className="space-y-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                          
                          {/* Item Selector dropdown */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-350 block">
                              {language === "bn" ? "কোন প্রোডাক্টটি বিজ্ঞাপন হিসেবে দেখাবেন?" : "Which car part do you want to promote?"}
                            </label>
                            
                            {listings.filter(item => item.sellerId === user.uid).length === 0 ? (
                              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-center">
                                <p className="text-xs text-slate-500 leading-relaxed">
                                  {language === "bn"
                                    ? "আপনার প্রোফাইলে কোনো লাইভ প্রোডাক্ট লিস্টিং নেই। বিজ্ঞাপন দেয়ার আগে আগে একটি লিস্টিং পোস্ট করুন।"
                                    : "You don't have any listings posted. Please publish an item before promoting."}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab("sell")}
                                  className="mt-3.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold py-1.5 px-4 rounded-lg transition cursor-pointer"
                                >
                                  {language === "bn" ? "প্রথম লিস্টিং পোস্ট করুন" : "Post Product first"}
                                </button>
                              </div>
                            ) : (
                              <select
                                id="campaign-listing-picker"
                                value={adSelectedListingId}
                                onChange={(e) => {
                                  setAdSelectedListingId(e.target.value);
                                  setAdPromoSuccess(false);
                                  setAdPromoError("");
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500/30 font-semibold cursor-pointer"
                              >
                                <option value="" className="bg-white text-slate-900">
                                  {language === "bn" ? "---একটি প্রোডাক্ট সিলেক্ট করুন---" : "---Choose a Posted Car Part---"}
                                </option>
                                {listings.filter(item => item.sellerId === user.uid).map((item) => (
                                  <option key={item.id} value={item.id} className="bg-white text-slate-900">
                                    {item.title} ({item.price ? `৳${item.price.toLocaleString()}` : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}) {item.isAd ? `[${language === "bn" ? "ইতিমধ্যে বুস্ট রয়েছে" : "Already boosted"}]` : ""}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Dynamic Feedback block */}
                          {adPromoError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs font-semibold">
                              ❌ {adPromoError}
                            </div>
                          )}

                          {adPromoSuccess && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-pulse">
                              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500 animate-spin-slow" />
                              <span>
                                {language === "bn" 
                                  ? "আপনার পেমেন্ট রিকোয়েস্টটি সফল হয়েছে এবং অ্যাড ক্যাম্পেইনটি সক্রিয় করা হয়েছে!" 
                                  : "Direct payment authorized and your campaign has been activated!"}
                              </span>
                            </div>
                          )}

                          {/* Payment: Real UddoktaPay Checkout — auto-activates ad, no TxID needed */}
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wide">
                              <Lock className="w-4 h-4 text-emerald-500" />
                              <span>{language === "bn" ? "bKash/Nagad/Rocket দ্বারা যাচাইকৃত" : "Verified via bKash/Nagad/Rocket"}</span>
                            </div>
                            <p className="text-xs text-slate-550 dark:text-slate-350 leading-relaxed font-semibold">
                              {language === "bn"
                                ? "নিচের বাটনে ট্যাপ করলে bKash/Nagad/Rocket-এর নিরাপদ চেকআউট পেজে যাবেন। পেমেন্ট সফল হওয়া মাত্রই বিজ্ঞাপনটি স্বয়ংক্রিয়ভাবে লাইভ হয়ে যাবে — কোনো TxID লিখতে হবে না।"
                                : "Tapping the button below takes you to a secure bKash/Nagad/Rocket checkout page. As soon as payment is confirmed, your ad goes live automatically — no TxID needed."}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              id="dash-launch-campaign-btn"
                              disabled={adPromoLoading || !adSelectedListingId}
                              onClick={handleDashboardPromoSubmit}
                              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase cursor-pointer"
                            >
                              {adPromoLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                                  <span>{language === "bn" ? "প্রসেস হচ্ছে..." : "Processing..."}</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4 text-slate-950" />
                                  <span>
                                    {language === "bn"
                                      ? `৳${(selectedPromoPkg?.price || 0).toLocaleString()} পেমেন্ট করুন`
                                      : `Pay ৳${(selectedPromoPkg?.price || 0).toLocaleString()}`}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* Right Block: Live Invoice Estimation Ledger */}
                      <div className="lg:col-span-5 space-y-4">
                        <h5 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                          {language === "bn" ? "পেমেন্ট গাইড ও ইনভয়েস বিল" : "CAMPAIGN INVOICE REPORT"}
                        </h5>

                        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 space-y-5 font-sans relative">

                          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                            <Lock className="w-4 h-4" />
                            <span>{language === "bn" ? "নিরাপদ পেমেন্ট চেকআউট" : "Secure Payment Checkout"}</span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400 font-medium">
                                {language === "bn" ? "ক্যাম্পেইন প্যাকেজ:" : "Campaign Package:"}
                              </span>
                              <span className="font-semibold text-slate-200">
                                {language === "bn" ? selectedPromoPkg?.nameBn : selectedPromoPkg?.nameEn}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs">
                              <span className="text-slate-405 font-medium">
                                {language === "bn" ? "বিজ্ঞাপনের মেয়াদকাল:" : "Ad Spot Duration:"}
                              </span>
                              <span className="font-semibold text-amber-400">
                                {selectedPromoPkg?.durationDays || "0"} {language === "bn" ? "দিন" : "days"} ({selectedPromoPkg ? selectedPromoPkg.durationDays * 24 : 0} {language === "bn" ? "ঘণ্টা" : "hours"})
                              </span>
                            </div>
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-405 font-medium">
                                {language === "bn" ? "টোটাল পেমেন্ট বিল:" : "Total Invoice Amount:"}
                              </span>
                              <span className="font-black text-emerald-400 text-sm">
                                ৳{selectedPromoPkg?.price.toLocaleString("en-IN") || "0"}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-800">
                            <div className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl text-[10px] text-slate-400 leading-normal space-y-1.5">
                              <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>{language === "bn" ? "কীভাবে কাজ করে:" : "How it works:"}</span>
                              </div>
                              <p>
                                {language === "bn"
                                  ? "বামের বাটনে ট্যাপ করে নিরাপদ bKash/Nagad/Rocket চেকআউট পেজে পেমেন্ট সম্পন্ন করুন।"
                                  : "Tap the button on the left to complete payment via the secure bKash/Nagad/Rocket checkout."}
                              </p>
                              <p>
                                {language === "bn"
                                  ? "পেমেন্ট নিশ্চিত হওয়া মাত্রই বিজ্ঞাপনটি স্বয়ংক্রিয়ভাবে লাইভ হয়ে যাবে — কোনো অপেক্ষা বা ম্যানুয়াল ভেরিফিকেশন লাগবে না।"
                                  : "As soon as payment is confirmed, your ad goes live automatically — no waiting, no manual verification."}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Section 3: Active boosted list tracker */}
                    <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                        {language === "bn" ? "আমার চলমান বিজ্ঞাপন এবং ক্যাম্পেইন ট্র্যাকিং" : "My Active Campaigns & Traffic Stats"}
                      </h4>

                      {listings.filter(item => item.sellerId === user.uid && item.isAd).length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center text-slate-500">
                          <p className="text-xs">{language === "bn" ? "আপনার প্রোফাইলে কোনো চলমান বিজ্ঞাপন ক্যাম্পেইন নেই।" : "No sponsored ad campaigns active for the current session. Choose a product above to boost!"}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {listings.filter(item => item.sellerId === user.uid && item.isAd).map((item) => (
                            <div 
                              key={item.id} 
                              className="bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex gap-4 items-center justify-between shadow-sm relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-400 text-slate-950 uppercase font-black text-[7px] tracking-wider rounded-bl">
                                {item.adTier} ad
                              </div>

                              <div className="flex gap-3.5 items-center min-w-0">
                                <img src={item.images && item.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border" referrerPolicy="no-referrer" loading="lazy" />
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold text-slate-850 dark:text-white truncate">{item.title}</h5>
                                  <div className="text-[10px] text-slate-400 mt-1 flex gap-2">
                                    <span className="font-semibold text-amber-500">{item.price ? `৳${item.price.toLocaleString()}` : (language === "bn" ? "মূল্য জানতে যোগাযোগ করুন" : "Price on Request")}</span>
                                    <span>•</span>
                                    <span>👀 {item.views || 0} views</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-550 font-bold border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                  LIVE
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleViewListingDetails(item)}
                                  className="text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:underline mt-1 cursor-pointer"
                                >
                                  {language === "bn" ? "পার্টস বিবরণ দেখুন" : "View Ad details"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {dashboardSubTab === 'admin' && isUserAdmin && (
                  <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                    <AdminPanel language={language} currentUser={userMetadata || user} listings={listings} isUserAdmin={isUserAdmin} />
                  </Suspense>
                )}

                {dashboardSubTab === 'playstore-audit' && (
                  <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                    <PlayStoreDiagnostics language={language} />
                  </Suspense>
                )}

              </div>
  );
}
