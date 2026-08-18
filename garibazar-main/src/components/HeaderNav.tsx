import { Grid, ShoppingBag, Plus, History, MessageSquare, User } from "lucide-react";
import { SupportedLanguage } from "../types";

export type ActiveTab = 'market' | 'saved' | 'sell' | 'my-dashboard' | 'chats' | 'profile';

interface HeaderNavProps {
  language: SupportedLanguage;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: any;
  unreadChatsCount: number;
  setIsAuthOpen: (open: boolean) => void;
  navDashboardLabel: string;
  navSellLabel: string;
}

/**
 * Desktop header navigation + mobile sticky bottom nav dock.
 * Pure presentational component - all state lives in App.tsx and is passed down as props.
 * Extracted from App.tsx to keep the root component smaller and easier to maintain.
 */
export function HeaderNav({
  language,
  activeTab,
  setActiveTab,
  user,
  unreadChatsCount,
  setIsAuthOpen,
  navDashboardLabel,
  navSellLabel,
}: HeaderNavProps) {
  return (
    <>
      {/* 1. Header & Navigation Panel */}
      <header className="hidden md:block sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800 text-slate-800 dark:text-white shadow-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo area with simple clean title as requested */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setActiveTab("market")}
            >
              <h1 className="text-xl sm:text-2xl font-black tracking-tight font-sans text-slate-850 dark:text-white leading-none">
                {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
              </h1>
            </div>

            {/* Quick Navigation tabs */}
            <nav className="hidden md:flex items-center gap-1.5">
              <button
                id="tab-market-btn"
                onClick={() => setActiveTab("market")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'market'
                    ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Grid className="w-4 h-4" />
                {navDashboardLabel}
              </button>

              <button
                id="tab-saved-btn"
                onClick={() => setActiveTab("saved")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'saved'
                    ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <span>{language === "bn" ? "আমার লিস্টিং ও বিজ্ঞাপনহাব" : "My Ads & Bookmarks"}</span>
              </button>

              <button
                id="tab-sell-btn"
                onClick={() => {
                  setActiveTab("sell");
                }}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'sell'
                    ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <Plus className="w-4 h-4 text-amber-500" />
                {navSellLabel}
              </button>

              {user && (
                <button
                  id="tab-profile-btn"
                  onClick={() => setActiveTab("my-dashboard")}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'my-dashboard'
                      ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <History className="w-4 h-4 text-emerald-500" />
                  {language === "bn" ? "আমার ড্যাশবোর্ড" : "My Wallet Center"}
                </button>
              )}

              <button
                id="tab-chats-btn"
                onClick={() => setActiveTab("chats")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'chats'
                    ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <MessageSquare className="w-4 h-4 text-teal-500" />
                <span>{language === "bn" ? "মেসেজ / চ্যাট" : "Messages"}</span>
                {unreadChatsCount > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-rose-600 rounded-full border border-white dark:border-slate-950"></span>
                )}
              </button>

              <button
                id="tab-profile-real-btn"
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'profile'
                    ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-slate-200/60 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <User className="w-4 h-4 text-amber-500" />
                <span>{language === "bn" ? "প্রোফাইল" : "Profile"}</span>
              </button>
            </nav>

            {/* Right control utilities (Duplicate controls removed as they are now in the Profile page) */}
            <div className="flex items-center gap-2">
              {!user && (
                <button
                  id="header-signin-btn"
                  onClick={() => setActiveTab("profile")}
                  className="bg-gradient-to-r from-amber-550 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-amber-550/15 cursor-pointer h-9 shrink-0 select-none"
                >
                  <User className="w-3.5 h-3.5 fill-slate-950 text-slate-950 shrink-0" />
                  <span>{language === "bn" ? "লগইন" : "Login"}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Sticky Bottom Navigation Dock (Perfect native App layout matching screenshot) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-t border-slate-300 dark:border-slate-800 shadow-[0_-8px_32px_rgba(0,0,0,0.12)] flex justify-around items-end pb-4 pt-2.5 px-2 text-[12px] antialiased">
        {/* Market */}
        <button
          id="tab-market-mobile-bottom"
          onClick={() => setActiveTab("market")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 relative ${
            activeTab === 'market'
              ? "text-amber-600 scale-105"
              : "text-slate-900 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white"
          }`}
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'market' ? 'bg-amber-500/15 dark:bg-amber-400/15' : ''}`}>
            <ShoppingBag className={`w-5.5 h-5.5 transition-transform duration-300 ${activeTab === 'market' ? 'stroke-[2.8] text-amber-600 dark:text-amber-400 scale-110' : 'stroke-[2.3] text-slate-800 dark:text-slate-200'}`} />
          </div>
          <span className={`text-[12.5px] tracking-tight transition-colors ${activeTab === 'market' ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black text-slate-900 dark:text-slate-100'}`}>
            {language === "bn" ? "মার্কেট" : "Market"}
          </span>
          {activeTab === 'market' && (
            <span className="absolute bottom-[-10px] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
          )}
        </button>

        {/* Sell / Add Button */}
        <button
          id="tab-sell-mobile-bottom"
          onClick={() => setActiveTab("sell")}
          className="flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 relative group"
        >
          <div className={`p-3 rounded-full transition-all duration-300 ${
            activeTab === 'sell'
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-110 -translate-y-2"
              : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300"
          }`}>
            <Plus className={`w-5.5 h-5.5 ${activeTab === 'sell' ? 'stroke-[3]' : 'stroke-[2.5]'}`} />
          </div>
          <span className={`text-[12.5px] tracking-tight transition-all duration-300 ${
            activeTab === 'sell' ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-900 dark:text-slate-100 font-black'
          }`}>{language === "bn" ? "বিক্রি" : "Sell"}</span>
          {activeTab === 'sell' && (
            <span className="absolute bottom-[-10px] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
          )}
        </button>

        {/* Dashboard/Profile */}
        <button
          id="tab-profile-mobile-bottom"
          onClick={() => {
            if (!user) {
              setIsAuthOpen(true);
            } else {
              setActiveTab("my-dashboard");
            }
          }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 relative ${
            activeTab === 'my-dashboard'
              ? "text-amber-600 scale-105"
              : "text-slate-900 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white"
          }`}
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'my-dashboard' ? 'bg-amber-500/15 dark:bg-amber-400/15' : ''}`}>
            <Grid className={`w-5.5 h-5.5 transition-transform duration-300 ${activeTab === 'my-dashboard' ? 'stroke-[2.8] text-amber-600 dark:text-amber-400 scale-110' : 'stroke-[2.3] text-slate-800 dark:text-slate-200'}`} />
          </div>
          <span className={`text-[12.5px] tracking-tight transition-colors ${activeTab === 'my-dashboard' ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black text-slate-900 dark:text-slate-100'}`}>
            {language === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}
          </span>
          {activeTab === 'my-dashboard' && (
            <span className="absolute bottom-[-10px] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
          )}
        </button>

        {/* Chat / Message */}
        <button
          id="tab-chats-mobile-bottom"
          onClick={() => setActiveTab("chats")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 relative ${
            activeTab === 'chats'
              ? "text-amber-600 scale-105"
              : "text-slate-900 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white"
          }`}
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 relative ${activeTab === 'chats' ? 'bg-amber-500/15 dark:bg-amber-400/15' : ''}`}>
            <MessageSquare className={`w-5.5 h-5.5 transition-transform duration-300 ${activeTab === 'chats' ? 'stroke-[2.8] text-amber-600 dark:text-amber-400 scale-110' : 'stroke-[2.3] text-slate-800 dark:text-slate-200'}`} />
            {unreadChatsCount > 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-600 rounded-full border border-white dark:border-slate-950 animate-pulse"></span>
            )}
          </div>
          <span className={`text-[12.5px] tracking-tight transition-colors ${activeTab === 'chats' ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black text-slate-900 dark:text-slate-100'}`}>
            {language === "bn" ? "চ্যাট" : "Chat"}
          </span>
          {activeTab === 'chats' && (
            <span className="absolute bottom-[-10px] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
          )}
        </button>

        {/* Profile / Settings */}
        <button
          id="tab-profile-mobile-bottom-real"
          onClick={() => setActiveTab("profile")}
          className={`flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all duration-300 relative ${
            activeTab === 'profile'
              ? "text-amber-600 scale-105"
              : "text-slate-900 dark:text-slate-100 hover:text-slate-950 dark:hover:text-white"
          }`}
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'profile' ? 'bg-amber-500/15 dark:bg-amber-400/15' : ''}`}>
            <User className={`w-5.5 h-5.5 transition-transform duration-300 ${activeTab === 'profile' ? 'stroke-[2.8] text-amber-600 dark:text-amber-400 scale-110' : 'stroke-[2.3] text-slate-800 dark:text-slate-200'}`} />
          </div>
          <span className={`text-[12.5px] tracking-tight transition-colors ${activeTab === 'profile' ? 'font-black text-amber-600 dark:text-amber-400' : 'font-black text-slate-900 dark:text-slate-100'}`}>
            {language === "bn" ? "প্রোফাইল" : "Profile"}
          </span>
          {activeTab === 'profile' && (
            <span className="absolute bottom-[-10px] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]"></span>
          )}
        </button>
      </div>
    </>
  );
}
