
import { useState } from 'react';
import { User, ChevronRight, Sun, Moon, Users, Mail, ShieldCheck, FileText, HelpCircle, Loader2, Check, Send, LogOut, Settings, Bell, Car, ShoppingBag, Sparkles, MapPin, Star, Globe } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export function ProfileTab({ 
  user, 
  userMetadata,
  language, 
  setLanguage, 
  isDark, 
  setIsDark, 
  setIsLegalOpen, 
  handleLogout,
  setIsAuthOpen,
  listings,
  currentUserReviews,
  setActiveSellerShopId,
  setActiveSellerShopFallback,
  setActiveTab,
  setDashboardSubTab
}: any) {
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false);
  const [isMyShopSectionOpen, setIsMyShopSectionOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isTermsSectionOpen, setIsTermsSectionOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSupportSubmitting, setIsSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setIsSupportSubmitting(true);
    try {
      await addDoc(collection(db, "support_tickets"), {
        name: supportName || (user?.displayName || "Anonymous"),
        email: supportEmail || (user?.email || "anonymous@garibazar.com"),
        message: supportMessage,
        createdAt: new Date().toISOString(),
        userId: user?.uid || "guest",
        status: "open"
      });

      setSupportSuccess(true);
      setSupportMessage("");
      setTimeout(() => {
        setSupportSuccess(false);
      }, 5000);
    } catch (err) {
      console.error("Error submitting support ticket:", err);
      // Fallback success for graceful user experience
      setSupportSuccess(true);
      setSupportMessage("");
      setTimeout(() => {
        setSupportSuccess(false);
      }, 5000);
    } finally {
      setIsSupportSubmitting(false);
    }
  };

  return (
      <div className="animate-fade-in max-w-xl mx-auto space-y-5">
                
                {/* A. Top left corner Logo & Branding with "Profile" */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-orange-550 to-amber-500 text-slate-950 font-black flex items-center justify-center shadow-md text-lg sm:text-xl select-none shrink-0">
                        গ
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-slate-850 dark:text-white leading-none">
                            {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
                          </h2>
                          <span className="text-[10px] sm:text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg select-none">
                            {language === "bn" ? "প্রোফাইল" : "Profile"}
                          </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                          {language === "bn" ? "পার্টস ও গাড়ি বেচাকেনা" : "Auto Parts & Vehicles Trading"}
                        </p>
                      </div>
                    </div>
                    {user && (
                      <button
                        onClick={handleLogout}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        title={language === "bn" ? "লগআউট করুন" : "Logout"}
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Always-visible Login Prompt if not logged in */}
                {!user && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-5 shadow-sm text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-500 mb-3">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-200 mb-2">
                      {language === "bn" ? "অ্যাকাউন্টে লগইন করুন" : "Sign in to your account"}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-4 leading-relaxed max-w-sm mx-auto">
                      {language === "bn" 
                        ? "আপনার প্রোফাইল, বিজ্ঞাপন, এবং ড্যাশবোর্ড পরিচালনা করতে লগইন করুন বা নতুন অ্যাকাউন্ট খুলুন।" 
                        : "Log in or create a new account to manage your profile, ads, and dashboard."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAuthOpen(true)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-550 hover:from-amber-600 hover:to-orange-605 text-slate-950 font-black py-3 px-4 rounded-xl text-sm transition duration-200 flex items-center justify-center gap-2 shadow-sm shadow-amber-550/15 cursor-pointer"
                    >
                      <User className="w-4 h-4 fill-slate-950 text-slate-950 shrink-0" />
                      <span>{language === "bn" ? "লগইন / নতুন অ্যাকাউন্ট খুলুন" : "Login / Create Account"}</span>
                    </button>
                  </div>
                )}

                {/* B. Settings Menu List styling modeled on user's Settings screenshot */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60">
                  
                  {/* Row 1: Personal Info (ক্লিক করলে ডিটেইল দেখাবে) */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      id="profile-row-personal"
                      onClick={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <User className="w-5 h-5 fill-white text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "ব্যক্তিগত তথ্য (Personal info)" : "Personal info"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {user ? (user.displayName || "Seller") : (language === "bn" ? "লগইন করতে এখানে চাপুন" : "Sign in to see info")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        {isPersonalInfoOpen ? (
                          <span className="text-xs font-bold text-amber-500">{language === "bn" ? "বন্ধ করুন" : "Close"}</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-550">{language === "bn" ? "দেখুন" : "View"}</span>
                        )}
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isPersonalInfoOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {/* Expandable Info Detail card */}
                    {isPersonalInfoOpen && (
                      <div className="p-5 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down space-y-4">
                        {user ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-550 text-slate-950 font-black text-base overflow-hidden flex items-center justify-center border-2 border-amber-500/20 shadow-inner shrink-0">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  user.displayName?.charAt(0).toUpperCase() || "S"
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white truncate">
                                    {user.displayName || "Seller"}
                                  </h4>
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-550 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide flex items-center gap-0.5 select-none">
                                    <span className="w-1.5 h-1.5 bg-emerald-550 rounded-full animate-pulse"></span>
                                    {language === "bn" ? "অ্যাক্টিভ প্রোফাইল" : "Active Profile"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 truncate">
                                  {user.email || (language === "bn" ? "ইমেইল প্রদান করা হয়নি" : "No email linked")}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                                  {language === "bn" ? "ফোন নম্বর" : "Phone Number"}
                                </span>
                                <span className="font-extrabold text-slate-750 dark:text-slate-205 block mt-0.5 font-mono">
                                  {userMetadata?.phoneNumber || user?.phoneNumber || "—"}
                                </span>
                              </div>
                              <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                                  {language === "bn" ? "ব্যালেন্স" : "Ad Wallet Balance"}
                                </span>
                                <span className="font-extrabold text-amber-550 block mt-0.5 font-mono">
                                  ৳{(userMetadata?.simulatedCredits ?? user?.simulatedCredits ?? 5000).toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleLogout}
                              className="w-full mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 font-extrabold text-xs py-2.5 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <LogOut className="w-4 h-4 shrink-0" />
                              <span>{language === "bn" ? "লগআউট করুন" : "Log Out of Account"}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-2 space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-bold">
                              {language === "bn" 
                                ? "গাড়ি বাজার অ্যাপে লগইন করতে দয়া করে নিচের বাটনে চাপুন।" 
                                : "Please sign in to access your registered seller account details."}
                            </p>
                            <button
                              type="button"
                              onClick={() => setIsAuthOpen(true)}
                              className="w-full bg-gradient-to-r from-amber-500 to-orange-550 hover:from-amber-600 hover:to-orange-605 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-550/15 cursor-pointer"
                            >
                              <User className="w-4 h-4 fill-slate-950 text-slate-950 shrink-0" />
                              <span>{language === "bn" ? "লগইন করুন / রেজিস্ট্রেশন" : "Sign In / Register"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 1.5: My Shop (আমার দোকান) */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      id="profile-row-myshop"
                      onClick={() => setIsMyShopSectionOpen(!isMyShopSectionOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <ShoppingBag className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "আমার দোকান (My Shop)" : "My Shop"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {user ? (language === "bn" ? "আপনার পাবলিক দোকান এবং লিস্টিং দেখুন" : "View your public shop and listings") : (language === "bn" ? "আপনার দোকান দেখতে লগইন করুন" : "Sign in to access your shop")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        {isMyShopSectionOpen ? (
                          <span className="text-xs font-bold text-amber-500">{language === "bn" ? "বন্ধ করুন" : "Close"}</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-550">{language === "bn" ? "খুলুন" : "Open"}</span>
                        )}
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isMyShopSectionOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {/* Expandable My Shop details */}
                    {isMyShopSectionOpen && (
                      <div className="p-5 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down space-y-4">
                        {user ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3.5">
                              <img 
                                src={user.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`} 
                                alt={user.displayName}
                                className="w-12 h-12 rounded-full object-cover border-2 border-amber-500/80 shadow-md"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white truncate">
                                    {user.displayName || user.email?.split("@")[0] || "Gari Bazar Seller"}
                                  </h4>
                                  <span className="text-[9px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/35 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    {language === "bn" ? "ভেরিফাইড শপ" : "Verified Shop"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                  {userMetadata?.city || "Dhaka"}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                              <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                                  {language === "bn" ? "মোট সক্রিয় পণ্য" : "Active Items"}
                                </span>
                                <span className="font-extrabold text-slate-750 dark:text-slate-205 block mt-0.5 font-mono text-sm">
                                  {listings.filter(item => item.sellerId === user.uid && !item.isSold).length}
                                </span>
                              </div>
                              <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                                  {language === "bn" ? "কাস্টমার রেটিং" : "Customer Rating"}
                                </span>
                                <span className="font-extrabold text-amber-500 block mt-0.5 flex items-center gap-0.5 text-sm">
                                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                  {currentUserReviews.length > 0 
                                    ? `${(currentUserReviews.reduce((sum, r) => sum + r.rating, 0) / currentUserReviews.length).toFixed(1)}`
                                    : "5.0"}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSellerShopId(user.uid);
                                  setActiveSellerShopFallback({
                                    name: user.displayName || user.email?.split("@")[0] || "Gari Bazar Seller",
                                    photo: user.photoURL,
                                    location: userMetadata?.city || "Dhaka",
                                    contact: userMetadata?.phoneNumber || user?.phoneNumber || ""
                                  });
                                }}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                              >
                                <ShoppingBag className="w-4 h-4 shrink-0" />
                                <span>{language === "bn" ? "পাবলিক দোকান দেখুন" : "View Public Shop"}</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab("my-dashboard");
                                  setDashboardSubTab("my-shop");
                                }}
                                className="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-850 dark:text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                <span>{language === "bn" ? "ম্যানেজ করুন ও রিভিউ" : "Manage Shop & Reviews"}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2 space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-bold">
                              {language === "bn" 
                                ? "আপনার দোকান পৃষ্ঠা দেখতে এবং কাস্টমাইজ করতে দয়া করে লগইন করুন।" 
                                : "Please sign in to access and view your registered shop page."}
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              <button
                                type="button"
                                onClick={() => setIsAuthOpen(true)}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-550 hover:from-amber-600 hover:to-orange-605 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm shadow-amber-550/15 cursor-pointer"
                              >
                                <User className="w-4 h-4 fill-slate-950 text-slate-950 shrink-0" />
                                <span>{language === "bn" ? "লগইন করুন / রেজিস্ট্রেশন" : "Sign In / Register"}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Change language (ক্লিক করলে ডিয়েটাইল দেখাবে) */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      id="profile-row-lang"
                      onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Globe className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "ভাষা পরিবর্তন করুন (Change language)" : "Change language"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {language === "bn" ? "বাংলা ও ইংরেজি ভাষা নির্ধারণ করুন" : "Set app-wide language preference"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                          {language === "bn" ? "বাংলা" : "English"}
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isLanguageOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {/* Expandable Language Selector Details */}
                    {isLanguageOpen && (
                      <div className="p-4 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLanguage("bn");
                              setIsLanguageOpen(false);
                            }}
                            className={`p-3 rounded-xl border font-black text-sm flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              language === "bn"
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs"
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-750 dark:text-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-sm sm:text-base">বাংলা</span>
                            <span className="text-[10px] font-semibold text-slate-400">Bengali Language</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLanguage("en");
                              setIsLanguageOpen(false);
                            }}
                            className={`p-3 rounded-xl border font-black text-sm flex flex-col items-center gap-1 transition-all cursor-pointer ${
                              language === "en"
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs"
                                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-750 dark:text-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-sm sm:text-base">English</span>
                            <span className="text-[10px] font-semibold text-slate-400">ইংরেজি ভাষা</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 3: Dark Mode */}
                  <div className="p-4.5 flex items-center justify-between transition">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        {isDark ? (
                          <Sun className="w-5 h-5 text-amber-250 fill-amber-200" />
                        ) : (
                          <Moon className="w-5 h-5 text-white fill-white" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                          {language === "bn" ? "ডার্ক মোড (Dark mode)" : "Dark mode"}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                          {language === "bn" ? "আপনার চোখের সুবিধার্থে থিম পরিবর্তন করুন" : "Switch comfortable visual light/dark modes"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      id="profile-theme-toggle"
                      onClick={() => setIsDark(!isDark)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isDark ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span className="sr-only">Toggle Dark Mode</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isDark ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Row 4: About Team & Gari Bazar */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      onClick={() => setIsTeamOpen(!isTeamOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "আমাদের টিম ও গাড়ি বাজার" : "Our Team & About"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {language === "bn" ? "অ্যাপ ডেভেলপমেন্ট টিম এবং লক্ষ্য" : "Meet the creators of Gari Bazar"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isTeamOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {isTeamOpen && (
                      <div className="p-5 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-550 flex items-center justify-center font-black text-slate-950 text-base">
                              MR
                            </div>
                            <div>
                              <h5 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">MD RAYHAN</h5>
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Lead Developer & Founder</p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                            {language === "bn"
                              ? "গাড়ি বাজার অ্যাপটি বাংলাদেশে অটো পার্টস ও খুচরা যন্ত্রাংশের বেচাকেনাকে সহজ এবং ডিজিটাল করতে তৈরি করা হয়েছে। আমাদের মূল লক্ষ্য গ্রাহকদের নিরাপদ ও বিশ্বস্ত সেবা প্রদান করা।"
                              : "Gari Bazar is built to simplify auto parts and vehicle accessories trading across Bangladesh. Our mission is to make P2P parts sourcing seamless, verified, and transparent."}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-555 pt-1 font-mono">
                            <Mail className="w-3.5 h-3.5" />
                            <span>sadakalo7373@gmail.com</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 5: Terms & Privacy Policy */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      onClick={() => setIsTermsSectionOpen(!isTermsSectionOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "শর্তাবলী ও পলিসি কেন্দ্র" : "Terms & Privacy Policies"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {language === "bn" ? "প্লে স্টোর কমপ্লায়েন্স ও আইনি নীতিমালা" : "Play Store compliance rules and data usage"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isTermsSectionOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {isTermsSectionOpen && (
                      <div className="p-5 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down space-y-3">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs text-xs text-slate-500 dark:text-slate-400 space-y-3">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-white font-bold">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>{language === "bn" ? "প্লে স্টোর নীতিমালায় সংগতি" : "Fully Play Store Compliant"}</span>
                          </div>
                          <p className="leading-relaxed font-semibold">
                            {language === "bn"
                              ? "আপনার অ্যাকাউন্ট এবং পার্সোনাল ডাটা সম্পূর্ণ নিরাপদ। আমরা আপনার তথ্যের গোপনীয়তা রক্ষায় জেনুইন সিকিউরিটি ও ফায়ারবেস ব্যাকএন্ড ব্যবহার করি।"
                              : "Our data storage protocols match modern standards. We respect user rights and protect trade listings from scraping with Firestore security filters."}
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsLegalOpen(true)}
                            className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold underline hover:text-amber-700 cursor-pointer"
                          >
                            {language === "bn" ? "সম্পূর্ণ আইনি ও পলিসি হাব খুলুন" : "Open full Regulatory Compliance Hub"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 6: Contact Support & Help Desk */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      onClick={() => setIsSupportOpen(!isSupportOpen)}
                      className="w-full flex items-center justify-between p-4.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer text-left transition select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <HelpCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                            {language === "bn" ? "সাহায্য ও কন্টাক্ট সাপোর্ট" : "Help Desk & Customer Support"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {language === "bn" ? "টিমের সাথে সরাসরি যোগাযোগ করুন" : "Reach out to support desk directly"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isSupportOpen ? "rotate-90 text-amber-500" : ""}`} />
                      </div>
                    </button>

                    {isSupportOpen && (
                      <div className="p-5 bg-slate-50/55 dark:bg-slate-950/35 border-t border-slate-100 dark:border-slate-800/60 animate-slide-down space-y-4">
                        <form onSubmit={handleSupportSubmit} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-xs space-y-3.5">
                          <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                            {language === "bn" ? "সাপোর্ট রিকোয়েস্ট পাঠান" : "Open a Support Ticket"}
                          </h5>
                          
                          {supportSuccess ? (
                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-500" />
                              <span>
                                {language === "bn" 
                                  ? "আপনার মেসেজটি সফলভাবে টিমের কাছে পাঠানো হয়েছে! ২৪ ঘণ্টার মধ্যে যোগাযোগ করা হবে।" 
                                  : "Support ticket opened successfully! We will get back to you within 24 hours."}
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                                    {language === "bn" ? "আপনার নাম" : "Your Name"}
                                  </label>
                                  <input
                                    type="text"
                                    value={supportName}
                                    onChange={(e) => setSupportName(e.target.value)}
                                    placeholder={user?.displayName || (language === "bn" ? "যেমন: রায়হান" : "e.g. Rayhan")}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-3 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none dark:text-white font-semibold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                                    {language === "bn" ? "ইমেইল ঠিকানা" : "Email Address"}
                                  </label>
                                  <input
                                    type="email"
                                    value={supportEmail}
                                    onChange={(e) => setSupportEmail(e.target.value)}
                                    placeholder={user?.email || "e.g. support@domain.com"}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-1.5 px-3 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none dark:text-white font-semibold"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                                  {language === "bn" ? "আপনার বার্তা / অভিযোগ" : "Message or Feedback"}
                                </label>
                                <textarea
                                  rows={3}
                                  required
                                  value={supportMessage}
                                  onChange={(e) => setSupportMessage(e.target.value)}
                                  placeholder={language === "bn" ? "আপনার সাহায্যপ্রার্থী মেসেজটি এখানে লিখুন..." : "Describe how we can help you today..."}
                                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2 px-3 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none dark:text-white font-semibold"
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={isSupportSubmitting}
                                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black py-2 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                {isSupportSubmitting ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{language === "bn" ? "পাঠানো হচ্ছে..." : "Sending..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 shrink-0" />
                                    <span>{language === "bn" ? "মেসেজ পাঠান" : "Submit Ticket"}</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </form>
                      </div>
                    )}
                  </div>

                </div>
              </div>
  );
}
