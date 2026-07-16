import { Search, SlidersHorizontal, Bell, Check, Plus, X, ShoppingBag, Loader2 } from "lucide-react";
import { ListingCard } from "./ListingCard";
import { PromotedSlider } from "./PromotedSlider";
import { CITIES } from "../translations";
import { PartListing, SupportedLanguage, TranslationSet } from "../types";
import type { ActiveTab } from "./HeaderNav";
import { logAnalyticsEvent } from "../firebase";
import vehicleCardImg from "../assets/images/vehicle-card-new.png";
import partsCardImg from "../assets/images/parts-card-new.png";

const VEHICLE_SUBCATEGORIES = [
  { id: "all", bnName: "সব গাড়ি", enName: "All Vehicles" },
  { id: "excavator", bnName: "এক্সক্যাভেটর", enName: "Excavator" },
  { id: "crane", bnName: "ক্রেন", enName: "Crane" },
  { id: "car", bnName: "কার", enName: "Car" },
  { id: "bus", bnName: "বাস", enName: "Bus" },
  { id: "bulldozer", bnName: "বুলডোজার", enName: "Bulldozer" },
  { id: "forklift", bnName: "ফর্কলিফ্ট", enName: "Forklift" },
  { id: "other_heavy_equipment", bnName: "অন্যান্য ভারী যন্ত্রপাতি", enName: "Other Heavy Equipment" }
];

const SPARE_PARTS_SUBCATEGORIES = [
  { id: "all", bnName: "সব পার্টস", enName: "All Parts" },
  { id: "engine_part", bnName: "ইঞ্জিন পার্ট", enName: "Engine Part" },
  { id: "light", bnName: "লাইট", enName: "Light" },
  { id: "pump", bnName: "পাম্প", enName: "Pump" },
  { id: "controller", bnName: "কন্ট্রোলার", enName: "Controller" },
  { id: "drive_motor", bnName: "ড্রাইভ মোটর", enName: "Drive Motor" },
  { id: "other_part", bnName: "অন্যান্য পার্টস", enName: "Other Part" }
];

const ALL_SUBCATEGORIES = [
  { id: "all", bnName: "সব ক্যাটাগরি", enName: "All Categories" },
  ...VEHICLE_SUBCATEGORIES.slice(1),
  ...SPARE_PARTS_SUBCATEGORIES.slice(1)
];

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
  showInstallPrompt: boolean;
  handleInstallApp: () => Promise<void>;
  dismissInstallPrompt: (forever: boolean) => void;
  showNotificationPrompt: boolean;
  setShowNotificationPrompt: (v: boolean) => void;
  notificationPermission: NotificationPermission;
  handleRequestNotificationPermission: () => Promise<void>;
}

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
  showInstallPrompt,
  handleInstallApp,
  dismissInstallPrompt,
  showNotificationPrompt,
  setShowNotificationPrompt,
  notificationPermission,
  handleRequestNotificationPermission,
}: MarketplaceTabProps) {
  return (
              <div>
                
                {/* 🚀 Search bar on top with history caching & Filter Tune Button */}
                <div className="relative mb-2.5 animate-[slide-down_0.2s_ease-out]">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Search className="w-5 h-5 text-amber-500" />
                      </span>
                      <input
                        id="global-search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            appendSearchHistory(searchQuery);
                          }
                        }}
                        placeholder={activeTranslations.searchPlaceholder}
                        className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/15 text-slate-900 dark:text-white shadow-xs font-semibold transition hover:border-amber-550/30"
                      />
                      {searchQuery.trim().length > 0 && (
                        <button 
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* মোবাইলে হেডার বাদ দেওয়ার পর, 🔔 নোটিফিকেশন বাটন সার্চ বারের পাশে বসানো হলো */}
                    <button
                      type="button"
                      onClick={() => {
                        if (notificationPermission === "granted") {
                          alert(language === "bn" ? "নোটিফিকেশন ইতিমধ্যে চালু আছে ✅" : "Notifications are already enabled ✅");
                        } else if (notificationPermission === "denied") {
                          alert(language === "bn" ? "নোটিফিকেশন বন্ধ করা আছে। ব্রাউজার/সাইট সেটিংস থেকে চালু করুন।" : "Notifications are blocked. Please allow them from your browser/site settings.");
                        } else {
                          setShowNotificationPrompt(true);
                        }
                      }}
                      className="md:hidden relative p-3 w-11 h-11 rounded-2xl border bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                      title={language === "bn" ? "নোটিফিকেশন" : "Notifications"}
                    >
                      <Bell className="w-5 h-5" />
                      {notificationPermission === "default" && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-white dark:border-slate-900"></span>
                      )}
                    </button>

                    {/* Reset/All Categories Button next to the 3-line filter button */}
                    {(selectedCategory !== "all" || selectedSubCategory !== "all" || selectedCity !== "all") && (
                      <button
                        onClick={() => {
                          setSelectedCategory("all");
                          setSelectedSubCategory("all");
                          setSelectedCity("all");
                        }}
                        className="px-3.5 py-1.5 h-11 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/35 text-rose-600 dark:text-rose-450 rounded-2xl flex items-center gap-1 cursor-pointer font-bold duration-200 transition-all select-none animate-fade-in shrink-0"
                        title={language === "bn" ? "সব ক্যাটাগরি একসাথে দেখুন (রিসেট)" : "All Categories (Reset)"}
                      >
                        <span className="text-xs font-black whitespace-nowrap pl-0.5">
                          {language === "bn" ? "সব ক্যাটাগরি" : "All Categories"}
                        </span>
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    )}

                    {/* Filter Tune Toggle Key */}
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

                  {/* Search History Tags layout */}
                  {searchHistory.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 px-0.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        {language === "bn" ? "ইতিহাস:" : "Recent Searches:"}
                      </span>
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
                        onClick={() => {
                          setSearchHistory([]);
                          localStorage.removeItem("gari_bazar_search_history");
                        }}
                        className="text-[9px] font-bold text-red-500 hover:underline ml-auto cursor-pointer"
                      >
                        {language === "bn" ? "মুছুন" : "Clear"}
                      </button>
                    </div>
                  )}
                </div>

                {/* 🚗 vs ⚙️ Side-by-Side Main Category Buy/Sell Buttons */}

          <div className="grid grid-cols-2 gap-2.5 mb-2.5 animate-[slide-down_0.2s_ease-out]">
            <button
              onClick={() => {
                const nextCat = selectedCategory === "vehicles" ? "all" : "vehicles";
                setSelectedCategory(nextCat);
                setSelectedSubCategory("all");
              }}
              className={`relative overflow-hidden rounded-2xl p-2 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${
                selectedCategory === "vehicles"
                  ? "ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-950 scale-[0.98]"
                  : "ring-1 ring-amber-200/60 dark:ring-slate-700"
              }`}
            >
              <span className="font-black text-[15px] text-amber-800 dark:text-amber-300 leading-tight">
                {language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
              </span>
              <span className="text-[10px] font-bold text-amber-700/70 dark:text-amber-400/70 leading-snug mt-0.5 mb-1">
                {language === "bn" ? "এক্সক্যাভেটর, ট্রাক, কার ও অন্যান্য নির্মাণ যানবাহন কিনুন বা বিক্রি করুন সহজে ও নিরাপদে" : "Buy or sell excavators, trucks, cars and other construction vehicles safely"}
              </span>
              <img
                src={vehicleCardImg}
                alt={language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
                className="w-full h-auto max-h-28 object-contain mt-auto"
              />
              {selectedCategory === "vehicles" && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md z-10">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </button>

            <button
              onClick={() => {
                const nextCat = selectedCategory === "spare_parts" ? "all" : "spare_parts";
                setSelectedCategory(nextCat);
                setSelectedSubCategory("all");
              }}
              className={`relative overflow-hidden rounded-2xl p-2 flex flex-col text-left cursor-pointer bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-sm transition-all duration-150 ${
                selectedCategory === "spare_parts"
                  ? "ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-950 scale-[0.98]"
                  : "ring-1 ring-sky-200/60 dark:ring-slate-700"
              }`}
            >
              <span className="font-black text-[15px] text-sky-800 dark:text-sky-300 leading-tight">
                {language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
              </span>
              <span className="text-[10px] font-bold text-sky-700/70 dark:text-sky-400/70 leading-snug mt-0.5 mb-1">
                {language === "bn" ? "ইঞ্জিন, হাইড্রোলিক পাম্প, গিয়ারবক্স, ফিল্টার, ব্যাটারি ও আরও অনেক কিছু" : "Engines, hydraulic pumps, gearboxes, filters, batteries & more"}
              </span>
              <img
                src={partsCardImg}
                alt={language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
                className="w-full h-auto max-h-28 object-contain mt-auto"
              />
              {selectedCategory === "spare_parts" && (
                <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md z-10">
                  <Check className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </div>


                {/* 🛠️ Modern Filters & Dynamic Sorting Panel (Revealed dynamically!) */}
                {showFilters && (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-3.5 mb-4 space-y-3.5 shadow-xs animate-fade-in text-slate-850 dark:text-slate-200">
                    {/* Dynamic resetting helper option if filtered */}
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                        {language === "bn" ? "ফিল্টার এবং সাজান:" : "Filter & Sort:"}
                      </span>
                    </div>

                    {/* Subcategories Selector List - Relocated beautifully here */}
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold uppercase tracking-wider block mb-2">
                        {language === "bn" ? "উপ-ক্যাটাগরি সমূহ:" : "Sub-Categories:"}
                      </span>
                      <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar gap-2 pb-1.5 -mx-1 px-1">
                        {(selectedCategory === "vehicles" 
                          ? VEHICLE_SUBCATEGORIES 
                          : selectedCategory === "spare_parts" 
                            ? SPARE_PARTS_SUBCATEGORIES 
                            : ALL_SUBCATEGORIES)
                          .map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedSubCategory(cat.id);
                              if (selectedCategory === "all" && cat.id !== "all") {
                                const isVehicleSub = VEHICLE_SUBCATEGORIES.some(v => v.id === cat.id);
                                const isPartsSub = SPARE_PARTS_SUBCATEGORIES.some(p => p.id === cat.id);
                                if (isVehicleSub) {
                                  setSelectedCategory("vehicles");
                                } else if (isPartsSub) {
                                  setSelectedCategory("spare_parts");
                                }
                              } else if (cat.id === "all") {
                                setSelectedSubCategory("all");
                              }
                              try {
                                logAnalyticsEvent("select_category", { category: cat.id });
                              } catch (_) {}
                            }}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                              selectedSubCategory === cat.id
                                ? "bg-amber-500 text-slate-950 shadow-xs scale-[0.98]"
                                : "bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                          >
                            {language === "bn" ? cat.bnName : cat.enName}
                          </button>
                        ))}
                      </div>
                    </div>

                  {/* 📍 Geographic District City Selector styled as beautiful Pills */}
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold uppercase tracking-wider block mb-2">
                      📍 {language === "bn" ? "স্থান অনুযায়ী ফিল্টার:" : "Filter by City:"}
                    </span>
                    <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar gap-1.5 -mx-1 px-1 items-center">
                      <button
                        onClick={() => {
                          setSelectedCity("all");
                          try {
                            logAnalyticsEvent("select_location", { location: "all" });
                          } catch (_) {}
                        }}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                          selectedCity === "all"
                            ? "bg-amber-500 text-slate-950 shadow-xs scale-[0.98]"
                            : "bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-5/50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {language === "bn" ? "সব জায়গা" : "All Cities"}
                      </button>
                      {/* Top Popular Cities as Quick-access Pills */}
                      {["Dhaka (ঢাকা)", "Chittagong (চট্টগ্রাম)", "Sylhet (সিলেট)", "Rajshahi (রাজশাহী)", "Khulna (খুলনা)", "Barisal (বরিশাল)"].map((city) => (
                        <button
                          key={city}
                          onClick={() => {
                            setSelectedCity(city);
                            try {
                              logAnalyticsEvent("select_location", { location: city });
                            } catch (_) {}
                          }}
                          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                            selectedCity === city
                              ? "bg-amber-500 text-slate-950 shadow-xs scale-[0.98]"
                              : "bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-5/50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {city}
                        </button>
                      ))}

                      {/* Dropdown selector for all 64 districts */}
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedCity(e.target.value);
                            try {
                              logAnalyticsEvent("select_location", { location: e.target.value });
                            } catch (_) {}
                          }
                        }}
                        value={CITIES.includes(selectedCity) && !["Dhaka (ঢাকা)", "Chittagong (চট্টগ্রাম)", "Sylhet (সিলেট)", "Rajshahi (রাজশাহী)", "Khulna (খুলনা)", "Barisal (বরিশাল)"].includes(selectedCity) ? selectedCity : ""}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-250 cursor-pointer bg-white dark:bg-slate-800 border border-slate-150 dark:border-slate-750 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 outline-none`}
                      >
                        <option value="">{language === "bn" ? "অন্যান্য জেলা..." : "Other Districts..."}</option>
                        {CITIES.map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ⚙️ Sorting Algorithm Selector styled as beautiful Pills */}
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 font-extrabold uppercase tracking-wider block mb-2">
                      ⚙️ {language === "bn" ? "সাজানোর নিয়ম:" : "Sort By:"}
                    </span>
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

                {/* 🚀 Boost Ads slide-show */}
                <PromotedSlider 
                  listings={filteredListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                />

                {/* 📲 PWA Install Prompt Banner — লগইন/রেজিস্টার করলে চিরতরে বন্ধ হয়ে যায় */}
                {showInstallPrompt && (
                  <div className="mb-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                      <img
                        src="/icon-192.png"
                        alt="Gari Bazar"
                        className="w-14 h-14 rounded-2xl shadow-md shrink-0 object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                          {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                          {language === "bn"
                            ? "অ্যাপটি হোমস্ক্রিনে ইনস্টল করুন"
                            : "Install this app on your home screen"}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      {language === "bn"
                        ? "দ্রুত লোড হবে এবং নোটিফিকেশন সরাসরি \"গাড়ি বাজার\" অ্যাপের নামে আসবে, Chrome থেকে না।"
                        : "Faster loading and notifications will come from the app itself, not Chrome."}
                    </p>
                    <div className="flex items-center justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => dismissInstallPrompt(false)}
                        className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-2.5 rounded-lg transition cursor-pointer"
                      >
                        {language === "bn" ? "পরে করুন" : "Later"}
                      </button>
                      <button
                        type="button"
                        onClick={handleInstallApp}
                        className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm active:scale-95"
                      >
                        {language === "bn" ? "ইনস্টল করুন" : "Install"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Notification Permission Request Banner */}
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
                          {language === "bn" 
                            ? "নতুন কোনো গাড়ির পার্টস লিস্টিং হলে বা গ্রাহক হোয়াটসঅ্যাপ/কল করতে চাইলে সাথে সাথে পুশ নোটিফিকেশন এ অ্যালার্ট বা মেসেজ পান।" 
                            : "Enable push alerts to get immediate updates whenever auto parts match your compatibility or are listed."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowNotificationPrompt(false)}
                        className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-3 py-2 rounded-lg transition cursor-pointer"
                      >
                        {language === "bn" ? "পরে করুন" : "Later"}
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestNotificationPermission}
                        className="text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/15 transition duration-200 cursor-pointer"
                      >
                        {language === "bn" ? "চালু করুন" : "Enable"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter count indicators - admin only, so a new marketplace doesn't look sparse to regular users */}
                {isUserAdmin && (
                  <div className="flex items-center justify-between mt-1 mb-3.5 px-1">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-extrabold font-sans">
                      {language === "bn" 
                        ? `মোট ${filteredListings.length} টি পার্টস পাওয়া গেছে` 
                        : `Found ${filteredListings.length} spares for compatibility`}
                    </div>
                  </div>
                )}

                {/* Sponsored / Ads Spotlight Header if any */}
                {filteredListings.some((item) => item.isAd) && (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                    <h3 className="text-sm font-extrabold font-sans text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                      {activeTranslations.adsTitle}
                    </h3>
                  </div>
                )}

                {/* MAIN GRID CARDS */}
                {listings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 my-8 shadow-sm flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-black text-slate-850 dark:text-white font-sans tracking-tight">
                      {language === "bn" ? "এখনো কোনো পণ্য নেই" : "No products yet"}
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-md mx-auto leading-relaxed font-semibold">
                      {language === "bn" 
                        ? "দুঃখিত, এই মুহূর্তে কোনো সক্রিয় পার্টস বা গাড়ি পোস্ট করা হয়নি। নতুন পণ্য পোস্ট করা হলে তা সরাসরি এখানে দেখতে পাবেন।" 
                        : "Sorry, there are no active parts or vehicles listed at the moment. Once items are posted, they will appear here."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("sell")}
                      className="mt-6 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/15 cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === "bn" ? "পার্টস বিক্রি করুন" : "Sell Part"}</span>
                    </button>
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 my-8">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-805 dark:text-slate-100">
                      {language === "bn" ? "কোন লিস্টিং পাওয়া যায়নি!" : "No Spare Parts Matches"}
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
                      {language === "bn" 
                        ? "অনুগ্রহ করে বানান পরিবর্তন করে ট্রাই করুন অথবা জেলা ফিল্টার পরিবর্তন করুন।" 
                        : "Try tweaking your keyword queries or removing location district constraints."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
  {filteredListings.map((listing) => (
    <ListingCard
      key={listing.id}
      listing={listing}
      language={language}
      isAdmin={isUserAdmin}
      onViewDetails={handleViewListingDetails}
      onPromoteClick={(item) => {
        if (!user) {
          setIsAuthOpen(true);
        } else {
          setPromotingListing(item);
        }
      }}
    />
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
                        <>
                          <span>{language === "bn" ? "আরো দেখুন" : "Load More"}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>
  );
}
