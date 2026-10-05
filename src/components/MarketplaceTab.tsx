import { Fragment, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Bell, Plus, X, ShoppingBag, Loader2, LayoutGrid, Car, Wrench, Bike, Truck, Construction, MapPin, Check } from "lucide-react";
import { ListingCard } from "./ListingCard";
import { PromotedSlider } from "./PromotedSlider";
import SearchPage from "./SearchPage";
import { CITIES } from "../translations";
import { PartListing, SupportedLanguage, TranslationSet } from "../types";
import type { ActiveTab } from "./HeaderNav";
import { logAnalyticsEvent } from "../utils/analytics";
import { pickRotatedAds, MAX_SPOTLIGHT_ADS } from "../utils/adRotation";
import { NativeAdSlot } from "./NativeAdSlot";

interface MarketplaceTabProps {
  language: SupportedLanguage;
  activeTranslations: TranslationSet;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  appendSearchHistory: (q: string) => void;
  searchHistory: string[];
  setSearchHistory: (h: string[]) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedSubCategory: string;
  setSelectedSubCategory: (v: string) => void;
  selectedCity: string;
  setSelectedCity: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  listings: PartListing[];
  adListings: PartListing[];
  filteredListings: PartListing[];
  hasMoreListings: boolean;
  loadingMoreListings: boolean;
  handleLoadMoreListings: () => Promise<void>;
  handleViewListingDetails: (listing: PartListing) => Promise<void>;
  isUserAdmin: boolean;
  user: any;
  setIsAuthOpen: (v: boolean) => void;
  setPromotingListing: (listing: PartListing | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setDashboardSubTab: (tab: 'inventory' | 'saved' | 'ads' | 'admin' | 'playstore-audit' | 'my-shop') => void;
  showInstallPrompt: boolean;
  handleInstallApp: () => Promise<void>;
  dismissInstallPrompt: (forever: boolean) => void;
  showNotificationPrompt: boolean;
  setShowNotificationPrompt: (v: boolean) => void;
  notificationPermission: NotificationPermission;
  handleRequestNotificationPermission: () => Promise<void>;
  setIsLotteryOpen: (v: boolean) => void;
}

// Native ad (শুধু Android অ্যাপে; ওয়েবে NativeAdSlot কিছুই দেখায় না):
// ৬ নম্বর লিস্টিংয়ের পরে, তারপর প্রতি ১২টায়, মোট সর্বোচ্চ ৩টা।
const isAdSlot = (index: number): boolean =>
  index === 5 || (index > 5 && (index - 5) % 12 === 0 && (index - 5) / 12 <= 2);

const POPULAR_CITIES = ["Dhaka (ঢাকা)", "Chittagong (চট্টগ্রাম)", "Sylhet (সিলেট)", "Rajshahi (রাজশাহী)", "Khulna (খুলনা)", "Barisal (বরিশাল)"];

// শহরের নাম "Dhaka (ঢাকা)" ফরম্যাটে থাকে -- search bar-এর ভেতরের ছোট্ট
// pill-এ পুরোটা আঁটবে না, তাই শুধু প্রথম অংশ (bracket-এর আগে পর্যন্ত) দেখানো হয়।
const getShortCityLabel = (selectedCity: string, language: SupportedLanguage): string => {
  if (selectedCity === "all") return language === "bn" ? "সব শহর" : "All City";
  return selectedCity.split(" (")[0];
};

/**
 * "Market" tab: search bar, category/city/sort filters, promoted-ads slider,
 * listing grid with load-more, PWA install prompt, notification-permission prompt.
 * Extracted from App.tsx to keep the root component smaller.
 * Pure presentational component - all state lives in App.tsx and is passed down as props.
 */
export default function MarketplaceTab({
  language,
  activeTranslations,
  searchQuery,
  setSearchQuery,
  appendSearchHistory,
  searchHistory,
  setSearchHistory,
  selectedCategory,
  setSelectedCategory,
  selectedSubCategory,
  setSelectedSubCategory,
  selectedCity,
  setSelectedCity,
  sortBy,
  setSortBy,
  showFilters,
  setShowFilters,
  listings,
  adListings,
  filteredListings,
  hasMoreListings,
  loadingMoreListings,
  handleLoadMoreListings,
  handleViewListingDetails,
  isUserAdmin,
  user,
  setIsAuthOpen,
  setPromotingListing,
  setActiveTab,
  setDashboardSubTab,
  showInstallPrompt,
  handleInstallApp,
  dismissInstallPrompt,
  showNotificationPrompt,
  setShowNotificationPrompt,
  notificationPermission,
  handleRequestNotificationPermission,
  setIsLotteryOpen,
}: MarketplaceTabProps) {
  const spotlightAds = useMemo(() => pickRotatedAds(adListings, MAX_SPOTLIGHT_ADS), [adListings]);
  // 🔧 (2026-10-02) যেগুলো উপরের "Premium Sponsored Spotlights" গ্রিডে
  // (spotlightAds) ইতিমধ্যে দেখানো হচ্ছে, সেগুলো নিচের মূল ফিডে আবার বাদ
  // দেওয়া হচ্ছে -- আগে একই বুস্ট পোস্ট দুই জায়গায় (উপরে স্পটলাইটে, আবার
  // নিচে স্বাভাবিক ক্রমে) দেখা যেত, ডুপ্লিকেট লাগছিল।
  const spotlightIds = useMemo(() => new Set(spotlightAds.map((item) => item.id)), [spotlightAds]);
  const displayListings = useMemo(
    () => filteredListings.filter((item) => !spotlightIds.has(item.id)),
    [filteredListings, spotlightIds]
  );

  const [isCityPickerOpen, setIsCityPickerOpen] = useState(false);
const [isSearchOpen, setIsSearchOpen] = useState(false);
const feedItems = useMemo(() => filteredListings.filter((item) => !spotlightIds.has(item.id)), [filteredListings, spotlightIds]);
const spotlightFiller = spotlightAds.length % 2 === 1 && feedItems.length > 0 ? feedItems[0] : null;
const spotlightGridItems = spotlightFiller ? [...spotlightAds, spotlightFiller] : spotlightAds;
const feedListings = spotlightFiller ? feedItems.slice(1) : feedItems;
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const otherCities = useMemo(() => CITIES.filter((c) => !POPULAR_CITIES.includes(c)), []);
  const filteredPopularCities = useMemo(
    () => POPULAR_CITIES.filter((c) => c.toLowerCase().includes(citySearchQuery.trim().toLowerCase())),
    [citySearchQuery]
  );
  const filteredOtherCities = useMemo(
    () => otherCities.filter((c) => c.toLowerCase().includes(citySearchQuery.trim().toLowerCase())),
    [otherCities, citySearchQuery]
  );
  const openCityPicker = () => { setCitySearchQuery(""); setIsCityPickerOpen(true); };
  const chooseCity = (city: string) => {
    setSelectedCity(city);
    try { logAnalyticsEvent("select_location", { location: city }); } catch (_) {}
    setIsCityPickerOpen(false);
  };

  return (
              <div>

                <div className="md:hidden flex items-center gap-1.5 mb-2 animate-[slide-down_0.2s_ease-out]">
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                      <Search className="w-4 h-4 text-amber-500" />
                    </span>
                    <input
                      id="global-search-input"
                      type="text"
                      value={searchQuery}
                      readOnly onClick={() => setIsSearchOpen(true)} onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") appendSearchHistory(searchQuery); }}
                      placeholder={activeTranslations.searchPlaceholder}
                      className="w-full pl-8 pr-[78px] py-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-[11px] focus:outline-none focus:ring-2 focus:ring-amber-500/15 text-slate-900 dark:text-white shadow-xs font-semibold transition hover:border-amber-550/30"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-1.5">
                      {searchQuery.trim().length > 0 && (
                        <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 cursor-pointer p-0.5 shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openCityPicker}
                        className="flex items-center gap-0.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-450 cursor-pointer max-w-[68px] shrink-0"
                        title={language === "bn" ? "শহর পরিবর্তন করুন" : "Change city"}
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="text-[9px] font-extrabold truncate">{getShortCityLabel(selectedCity, language)}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-1.5 w-8 h-8 rounded-full border transition-all duration-200 flex items-center justify-center cursor-pointer shrink-0 relative ${
                      showFilters || selectedCategory !== "all" || selectedSubCategory !== "all"
                        ? "bg-amber-500 border-amber-500 text-slate-950 shadow-md scale-[0.98]"
                        : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-amber-550/30 hover:text-amber-500"
                    }`}
                    title={language === "bn" ? "ফিল্টার পরিবর্তন" : "Toggle Filters"}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {(selectedCategory !== "all" || selectedSubCategory !== "all" || selectedCity !== "all") && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (notificationPermission === "granted") {
                        alert(language === "bn" ? "নোটিফিকেশন ইতমধ্যে চালু আছে ✅" : "Notifications are already enabled ✅");
                      } else if (notificationPermission === "denied") {
                        alert(language === "bn" ? "নোটিফিকেশন বন্ধ করা আছে। ব্রাউজার/সাইট সেটিংস থেকে চালু করুন।" : "Notifications are blocked. Please allow them from your browser/site settings.");
                      } else {
                        setShowNotificationPrompt(true);
                      }
                    }}
                    className="relative p-1.5 w-8 h-8 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 flex items-center justify-center"
                    title={language === "bn" ? "নোটিফিকেশন" : "Notifications"}
                  >
                    <Bell className="w-4 h-4" />
                    {notificationPermission === "default" && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-500 border border-white dark:border-slate-900"></span>
                    )}
                  </button>
                </div>

                {(selectedCategory !== "all" || selectedSubCategory !== "all" || selectedCity !== "all") && (
                  <div className="md:hidden mb-2 -mt-1">
                    <button
                      onClick={() => { setSelectedCategory("all"); setSelectedSubCategory("all"); setSelectedCity("all"); }}
                      className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/35 text-rose-600 dark:text-rose-450 rounded-full inline-flex items-center gap-1 cursor-pointer font-bold duration-200 transition-all select-none animate-fade-in"
                      title={language === "bn" ? "সব ক্যাটাগরি একসাথে দেখুন (রিসেট)" : "All Categories (Reset)"}
                    >
                      <span className="text-[11px] font-black whitespace-nowrap">{language === "bn" ? "সব ক্যাটাগরি" : "All Categories"}</span>
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                )}

                <div className="relative mb-2.5 animate-[slide-down_0.2s_ease-out] hidden md:block">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Search className="w-5 h-5 text-amber-500" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        readOnly onClick={() => setIsSearchOpen(true)} onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") appendSearchHistory(searchQuery); }}
                        placeholder={activeTranslations.searchPlaceholder}
                        className="w-full pl-11 pr-24 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 text-slate-900 dark:text-white shadow-xs font-semibold transition hover:border-amber-550/30"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2.5">
                        {searchQuery.trim().length > 0 && (
                          <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 cursor-pointer p-0.5 shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openCityPicker}
                          className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700 text-amber-600 dark:text-amber-450 cursor-pointer max-w-[84px] shrink-0"
                          title={language === "bn" ? "শহর পরিবর্তন করুন" : "Change city"}
                        >
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs font-extrabold truncate">{getShortCityLabel(selectedCity, language)}</span>
                        </button>
                      </div>
                    </div>

                    {(selectedCategory !== "all" || selectedSubCategory !== "all" || selectedCity !== "all") && (
                      <button
                        onClick={() => { setSelectedCategory("all"); setSelectedSubCategory("all"); setSelectedCity("all"); }}
                        className="px-3.5 py-1.5 h-11 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/35 text-rose-600 dark:text-rose-450 rounded-2xl flex items-center gap-1 cursor-pointer font-bold duration-200 transition-all select-none animate-fade-in shrink-0"
                        title={language === "bn" ? "সব ক্যাটাগরি একসাথে দেখুন (রিসেট)" : "All Categories (Reset)"}
                      >
                        <span className="text-xs font-black whitespace-nowrap pl-0.5">{language === "bn" ? "সব ক্যাটাগরি" : "All Categories"}</span>
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    )}

                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-3 w-11 h-11 rounded-2xl border transition-all duration-200 flex items-center justify-center cursor-pointer shrink-0 relative ${
                        showFilters || selectedCategory !== "all" || selectedSubCategory !== "all"
                          ? "bg-amber-500 border-amber-500 text-slate-950 shadow-md scale-[0.98]" 
                          : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-amber-550/30 hover:text-amber-500"
                      }`}
                      title={language === "bn" ? "ফিল্টার পরিবর্তন" : "Toggle Filters"}
                    >
                      <SlidersHorizontal className="w-5 h-5" />
                      {(selectedCategory !== "all" || selectedSubCategory !== "all" || selectedCity !== "all") && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-slate-950 rounded-full"></span>
                      )}
                    </button>
                  </div>

                  {searchHistory.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 px-0.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">{language === "bn" ? "ইতিহাস:" : "Recent Searches:"}</span>
                      {searchHistory.map((hist, i) => (
                        <button
                          key={i}
                          onClick={() => setSearchQuery(hist)}
                          className="text-[10px] font-extrabold px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-550 dark:text-slate-400 rounded-lg transition overflow-hidden truncate max-w-[120px] cursor-pointer"
                        >
                          🕒 {hist}
                        </button>
                      ))}
                      <button
                        onClick={() => { setSearchHistory([]); localStorage.removeItem("gari_bazar_search_history"); }}
                        className="text-[9px] font-bold text-red-500 hover:underline ml-auto cursor-pointer"
                      >
                        {language === "bn" ? "মুছুন" : "Clear"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar gap-2.5 mb-3 pb-0.5 animate-[slide-down_0.2s_ease-out]">
                  {([
                    { id: "quick_all", icon: LayoutGrid, bn: "সব", en: "All", active: selectedCategory === "all" && selectedSubCategory === "all", onClick: () => { setSelectedCategory("all"); setSelectedSubCategory("all"); } },
                    { id: "quick_car", icon: Car, bn: "কার", en: "Car", active: selectedCategory === "vehicles" && selectedSubCategory === "car", onClick: () => { setSelectedCategory("vehicles"); setSelectedSubCategory("car"); } },
                    { id: "quick_parts", icon: Wrench, bn: "পার্টস", en: "Part", active: selectedCategory === "spare_parts", onClick: () => { setSelectedCategory("spare_parts"); setSelectedSubCategory("all"); } },
                    { id: "quick_bike", icon: Bike, bn: "বাইক", en: "Bike", active: selectedCategory === "vehicles" && selectedSubCategory === "bike", onClick: () => { setSelectedCategory("vehicles"); setSelectedSubCategory("bike"); } },
                    { id: "quick_truck", icon: Truck, bn: "ট্রাক", en: "Truck", active: selectedCategory === "vehicles" && selectedSubCategory === "truck", onClick: () => { setSelectedCategory("vehicles"); setSelectedSubCategory("truck"); } },
                    { id: "quick_heavy", icon: Construction, bn: "হেভি ইকুইপ.", en: "Heavy Equip.", active: selectedCategory === "vehicles" && selectedSubCategory === "other_heavy_equipment", onClick: () => { setSelectedCategory("vehicles"); setSelectedSubCategory("other_heavy_equipment"); } },
                  ] as const).map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { item.onClick(); try { logAnalyticsEvent("select_category", { category: item.id }); } catch (_) {} }}
                        className={`shrink-0 flex flex-col items-center justify-center gap-1 w-16 py-2 rounded-2xl border transition-all duration-150 cursor-pointer ${
                          item.active
                            ? "bg-amber-500 border-amber-500 text-slate-950 shadow-md scale-[0.98]"
                            : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400/50"
                        }`}
                      >
                        <ItemIcon className="w-5 h-5" />
                        <span className="text-[10px] font-extrabold leading-none whitespace-nowrap">{language === "bn" ? item.bn : item.en}</span>
                      </button>
                    );
                  })}
                </div>

                {showFilters && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-3.5 mb-4 space-y-3.5 shadow-xs animate-fade-in text-slate-850 dark:text-slate-200">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{language === "bn" ? "সাজান:" : "Sort:"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold uppercase tracking-wider block mb-2">⚙️ {language === "bn" ? "সাজানোর নিয়ম:" : "Sort By:"}</span>
                      <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar gap-1.5 -mx-1 px-1">
                        {[
                          { id: "latest", bnName: "সর্বশেষ (নতুন)", enName: "Newest" },
                          { id: "priceAsc", bnName: "দাম: কম-বেশি", enName: "Price: Low-High" },
                          { id: "priceDesc", bnName: "দাম: বেশি-কম", enName: "Price: High-Low" },
                          { id: "popularity", bnName: "জনপ্রিয়তা", enName: "Popularity" }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setSortBy(option.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                              sortBy === option.id
                                ? "bg-amber-500 text-slate-950 shadow-xs scale-[0.98]"
                                : "bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-5/50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {language === "bn" ? option.bnName : option.enName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <PromotedSlider
                  listings={spotlightAds}
                  language={language}
                  onViewListing={handleViewListingDetails}
                  onOpenLottery={() => setIsLotteryOpen(true)}
                  onGoToAdsPage={() => {
                    if (!user) { setIsAuthOpen(true); return; }
                    setActiveTab("my-dashboard");
                    setDashboardSubTab("ads");
                  }}
                />

                {/* 🔧 (2026-10-01) আসল, আলাদা "শুধু বুস্ট পোস্ট" গ্রিড -- আগে এই
                    জায়গায় যেই "Premium Sponsored Spotlights" হেডার দেখানো হতো,
                    সেটা আসলে নিচের সাধারণ মূল গ্রিডেরই (ads + organic মিশানো)
                    একটা ভুল লেবেল ছিল, তাই বুস্ট-ছাড়া পোস্টও "স্পনসর্ড" হেডারের
                    নিচে দেখাত আর কোনো "বিজ্ঞাপন" ব্যাজ থাকত না। এখন এটা সত্যিকারের
                    একটা পৃথক গ্রিড -- শুধু spotlightAds (সর্বোচ্চ MAX_SPOTLIGHT_ADS,
                    impression-count অনুযায়ী ন্যায্যভাবে ঘোরানো) দেখায়, উপরের
                    স্লাইডারের মতোই, সবসময় উপরে, মূল ফিডের আগে। নিচের মূল গ্রিড
                    থেকে এই একই পোস্টগুলো বাদ দেওয়া হয় (displayListings), যাতে
                    ডুপ্লিকেট না দেখায়। */}
                {spotlightAds.length > 0 && (
                  <div className="mb-5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                      <h3 className="text-sm font-extrabold font-sans text-amber-600 dark:text-amber-400 uppercase tracking-widest">{activeTranslations.adsTitle}</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                      {spotlightGridItems.map((listing) => (
                        <ListingCard
                          key={`spotlight-${listing.id}`}
                          listing={listing}
                          language={language}
                          isAdmin={isUserAdmin}
                          onViewDetails={handleViewListingDetails}
                          onPromoteClick={(item) => { if (!user) { setIsAuthOpen(true); } else { setPromotingListing(item); } }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {showNotificationPrompt && (
                  <div className="mb-6 bg-gradient-to-r from-blue-600/10 to-orange-505/10 border border-orange-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-orange-505 text-white rounded-xl shadow-md shrink-0 flex items-center justify-center">
                        <Bell className="w-5 h-5 animate-bounce" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1.5 leading-snug">
                          {language === "bn" ? "নতুন ডিল ও পার্টসের নোটিফিকেশন পান!" : "Never Miss Car Parts Deals!"}
                          <span className="text-[9px] bg-sky-500 text-white font-black uppercase tracking-wider px-1.5 py-0.5 rounded">FCM</span>
                        </h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                          {language === "bn" ? "নতুন কোনো গাড়ির পার্টস লিস্টিং হলে বা গ্রাহক হোয়াটসঅ্যাপ/কল করতে চাইলে সাথে সাথে পুশ নোটিফিকেশন এ অ্যালার্ট বা মেসেজ পান।" : "Enable push alerts to get immediate updates whenever auto parts match your compatibility or are listed."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button type="button" onClick={() => setShowNotificationPrompt(false)} className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-3 py-2 rounded-lg transition cursor-pointer">
                        {language === "bn" ? "পরে করুন" : "Later"}
                      </button>
                      <button type="button" onClick={handleRequestNotificationPermission} className="text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/15 transition duration-200 cursor-pointer">
                        {language === "bn" ? "চালু করুন" : "Enable"}
                      </button>
                    </div>
                  </div>
                )}

                {listings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 my-8 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-black text-slate-850 dark:text-white font-sans tracking-tight">{language === "bn" ? "এখনো কোনো পণ্য নেই" : "No products yet"}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-md mx-auto leading-relaxed font-semibold">
                      {language === "bn" ? "দুঃখিত, এই মুহূর্তে কোনো সক্রিয় পার্টস বা গাড়ি পোস্ট করা হয়নি। নতুন পণ্য পোস্ট করা হলে তা সরাসরি এখানে দেখতে পাবেন।" : "Sorry, there are no active parts or vehicles listed at the moment. Once items are posted, they will appear here."}
                    </p>
                    <button type="button" onClick={() => setActiveTab("sell")} className="mt-6 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/15 cursor-pointer flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      <span>{language === "bn" ? "পার্টস বিক্রি করুন" : "Sell Part"}</span>
                    </button>
                  </div>
                ) : filteredListings.length === 0 && searchQuery.trim().length === 0 && (loadingMoreListings || hasMoreListings) ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 my-8 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{language === "bn" ? "খোঁজা হচ্ছে..." : "Searching..."}</h4>
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 my-8">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-805 dark:text-slate-100">{language === "bn" ? "কোন লিস্টিং পাওয়া যায়নি!" : "No Spare Parts Matches"}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                      {language === "bn" ? "অনুগ্রহ করে বানান পরিবর্তন করে ট্রাই করুন অথবা জেলা ফিল্টার পরিবর্তন করুন।" : "Try tweaking your keyword queries or removing location district constraints."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
  {feedListings.map((listing, index) => (<Fragment key={listing.id}>
    <ListingCard
      key={listing.id}
      listing={listing}
      language={language}
      isAdmin={isUserAdmin}
      priority={index === 0}
      onViewDetails={handleViewListingDetails}
      onPromoteClick={(item) => { if (!user) { setIsAuthOpen(true); } else { setPromotingListing(item); } }}
    />{isAdSlot(index) && <NativeAdSlot slotId={`feed-ad-${index}`} />}</Fragment>
  ))}
</div>
)}
               
                {hasMoreListings && (
                  <div className="flex justify-center mt-8 mb-4">
                    <button
                      onClick={handleLoadMoreListings}
                      disabled={loadingMoreListings}
                      className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-98 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-sm border border-slate-200/50 dark:border-slate-800"
                    >
                      {loadingMoreListings ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          <span>{language === "bn" ? "লোড হচ্ছে..." : "Loading..."}</span>
                        </>
                      ) : (
                        <span>{language === "bn" ? "আরো দেখুন" : "Load More"}</span>
                      )}
                    </button>
                  </div>
                )}

{isSearchOpen && <SearchPage language={language} listings={[...adListings, ...listings.filter((l) => !adListings.some((a) => a.id === l.id))]} searchHistory={searchHistory} onSaveHistory={appendSearchHistory} onClose={() => setIsSearchOpen(false)} onSelect={(l) => { setIsSearchOpen(false); handleViewListingDetails(l); }} />}
                {isCityPickerOpen && (
                  <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setIsCityPickerOpen(false)}>
                    <div className="absolute inset-0 bg-black/40 animate-fade-in"></div>
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-slide-down" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center pt-2.5">
                        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                      </div>
                      <div className="flex items-center justify-between px-5 pt-3 pb-2">
                        <h3 className="text-lg font-black text-slate-850 dark:text-white">{language === "bn" ? "শহর নির্বাচন করুন" : "Select city"}</h3>
                        <button onClick={() => setIsCityPickerOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="px-5 pb-3">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            autoFocus
                            value={citySearchQuery}
                            onChange={(e) => setCitySearchQuery(e.target.value)}
                            placeholder={language === "bn" ? "খুঁজুন" : "Search"}
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white font-semibold"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto px-5 pb-6 flex-1">
                        {citySearchQuery.trim().length === 0 && (
                          <button
                            onClick={() => chooseCity("all")}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold mb-3 transition ${
                              selectedCity === "all" ? "bg-amber-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750"
                            }`}
                          >
                            <span>{language === "bn" ? "সব শহর" : "All Cities"}</span>
                            {selectedCity === "all" && <Check className="w-4 h-4" />}
                          </button>
                        )}

                        {filteredPopularCities.length > 0 && (
                          <>
                            <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2 mt-1">{language === "bn" ? "জনপ্রিয় শহর" : "Popular Cities"}</p>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 mb-4">
                              {filteredPopularCities.map((city) => (
                                <button key={city} onClick={() => chooseCity(city)} className="w-full flex items-center justify-between py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  <span>{city}</span>
                                  {selectedCity === city && <Check className="w-4 h-4 text-amber-500" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {filteredOtherCities.length > 0 && (
                          <>
                            <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">{language === "bn" ? "অন্যান্য শহর" : "Other Cities"}</p>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredOtherCities.map((city) => (
                                <button key={city} onClick={() => chooseCity(city)} className="w-full flex items-center justify-between py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  <span>{city}</span>
                                  {selectedCity === city && <Check className="w-4 h-4 text-amber-500" />}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {filteredPopularCities.length === 0 && filteredOtherCities.length === 0 && (
                          <p className="text-center text-sm text-slate-400 py-8">{language === "bn" ? "কোনো শহর পাওয়া যায়নি" : "No cities found"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
  );
}
