/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { auth, db, logAnalyticsEvent } from "./firebase";
import { logger } from "./utils/logger";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc, updateDoc, where, addDoc, deleteDoc, limit, startAfter, DocumentSnapshot } from "firebase/firestore";
import { 
  Car, 
  Search, 
  Sparkles, 
  User, 
  Plus, 
  MapPin, 
  LogOut, 
  Tag, 
  Globe, 
  Loader2, 
  History, 
  ShoppingBag, 
  TrendingUp, 
  Eye, 
  SquarePlay, 
  Phone,
  Grid,
  Heart,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Coins,
  Send,
  Check,
  Copy,
  X,
  Star,
  CheckCircle2,
  Trash2,
  SquarePen,
  Share2,
  Bell,
  Gift,
  Wrench,
  RotateCw,
  Truck,
} from "lucide-react";

import { PartListing, SupportedLanguage } from "./types";
import { translations, CITIES, CATEGORIES, SAMPLE_LISTINGS, AD_PACKAGES } from "./translations";
import { PromotedSlider } from "./components/PromotedSlider";
import { ListingCard } from "./components/ListingCard";
import { HeaderNav } from "./components/HeaderNav";
// 📦 নিচের কম্পোনেন্টগুলো lazy-loaded — এগুলোর কোড শুধু তখনই ডাউনলোড হবে যখন
// ইউজার সত্যিই সেই অংশে যাবে (modal খুলবে/ট্যাব বদলাবে), শুরুতেই না।
const ListingDetailModal = lazy(() => import("./components/ListingDetailModal").then(m => ({ default: m.ListingDetailModal })));
const EditListingModal = lazy(() => import("./components/EditListingModal").then(m => ({ default: m.EditListingModal })));
const AuthModal = lazy(() => import("./components/AuthModal").then(m => ({ default: m.AuthModal })));
const PromoteAdModal = lazy(() => import("./components/PromoteAdModal").then(m => ({ default: m.PromoteAdModal })));
const AddPartForm = lazy(() => import("./components/AddPartForm").then(m => ({ default: m.AddPartForm })));
const RefillModal = lazy(() => import("./components/RefillModal").then(m => ({ default: m.RefillModal })));
const AdminPanel = lazy(() => import("./components/AdminPanel").then(m => ({ default: m.AdminPanel })));
const ChatView = lazy(() => import("./components/ChatView").then(m => ({ default: m.ChatView })));
const PlayStoreDiagnostics = lazy(() => import("./components/PlayStoreDiagnostics").then(m => ({ default: m.PlayStoreDiagnostics })));
const LegalHubModal = lazy(() => import("./components/LegalHubModal"));
const PrivacyPolicyPage = lazy(() => import("./components/PrivacyPolicyPage"));
const DataDeletionPage = lazy(() => import("./components/DataDeletionPage"));
const SellerAnalyticsGraph = lazy(() => import("./components/SellerAnalyticsGraph"));
const SellerShopPage = lazy(() => import("./components/SellerShopPage").then(m => ({ default: m.SellerShopPage })));
const DashboardTab = lazy(() => import("./components/DashboardTab"));
const MarketplaceTab = lazy(() => import("./components/MarketplaceTab"));
import Fuse from "fuse.js";
import { buildSearchBlob, convertBengaliDigitsToEnglish, convertEnglishDigitsToBengali, toPhoneticKey } from "./searchAliases";
import { MessageSquare, Cpu, SlidersHorizontal, Moon, Sun, Users, HelpCircle, Mail, FileText, Menu, ChevronDown, Lock, CreditCard } from "lucide-react";
import vehicleCardImg from "./assets/images/vehicle-card-new.png";
import partsCardImg from "./assets/images/parts-card-new.png";

const HOME_CATEGORIES = [
  { id: "all", bnName: "সব ক্যাটাগরি", enName: "All Categories" },
  { id: "vehicles", bnName: "গাড়ি ও ভারী যন্ত্রপাতি", enName: "Vehicles & Equipment" },
  { id: "engine", bnName: "ইঞ্জিন ও ট্রান্সমিশন", enName: "Engine & Transmission" },
  { id: "wheels", bnName: "টায়ার ও হুইল", enName: "Tyres & Wheels" },
  { id: "interior", bnName: "ইন্টেরিয়র পার্টস", enName: "Interior Accessories" },
  { id: "exterior", bnName: "এক্সটেরিয়র বডি", enName: "Exterior Body" },
];

const checkIsProduction = (): boolean => {
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("ais-pre-") || window.location.hostname.includes("production")) {
      return true;
    }
    if (window.location.search.includes("prod=true")) {
      return true;
    }
  }
  return import.meta.env.PROD || (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production");
};

const isItemVehicle = (item: PartListing): boolean => {
  if (!item) return false;
  if (item.category === "vehicles") return true;
  if (item.category === "spare_parts") return false;
  
  // Fallback check on subcategory
  if (item.subCategory) {
    const isVehicleSub = ["excavator", "crane", "car", "bus", "bulldozer", "forklift", "other_heavy_equipment"].includes(item.subCategory);
    if (isVehicleSub) return true;
    const isPartsSub = ["engine_part", "light", "pump", "controller", "drive_motor", "other_part"].includes(item.subCategory);
    if (isPartsSub) return false;
  }
  
  // Default fallback check based on keywords in title
  const titleLower = (item.title || "").toLowerCase();
  const vehicleKeywords = ["excavator", "crane", "bulldozer", "forklift", "loader", "car", "bus", "truck", "pickup", "hilux", "toyota", "komatsu", "crawler", "মেশিন", "গাড়ি", "এক্সকাভেটর", "এক্সক্যাভেটর", "ক্রেন", "বুলডোজার", "বাস"];
  if (vehicleKeywords.some(keyword => titleLower.includes(keyword))) {
    // Make sure it's not a spare part of a vehicle
    const partKeywords = ["part", "pump", "chain", "pulley", "hook", "motor", "engine", "piston", "filter", "পার্ট", "পাম্প", "চেইন", "ইঞ্জিন", "মোটর"];
    if (partKeywords.some(keyword => titleLower.includes(keyword))) {
      return false; // probably a spare part
    }
    return true;
  }
  
  return false; // Default to parts/machinery
};

export default function App() {
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem("gari_bazar_language");
      if (saved === "bn" || saved === "en") return saved as SupportedLanguage;
    } catch (e) {}
    return "bn"; // DEFAULT to Bengali as requested
  });
  const [activeTab, setActiveTab] = useState<'market' | 'saved' | 'sell' | 'my-dashboard' | 'chats' | 'profile'>(() => {
    try {
      const saved = localStorage.getItem("gari_bazar_active_tab");
      const validTabs = ['market', 'saved', 'sell', 'my-dashboard', 'chats', 'profile'];
      if (saved && validTabs.includes(saved)) {
        return saved as 'market' | 'saved' | 'sell' | 'my-dashboard' | 'chats' | 'profile';
      }
    } catch (e) {}
    return 'market';
  });
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [initialListingToChat, setInitialListingToChat] = useState<PartListing | null>(null);
  
  // Persist language & active tab so a reload keeps the user where they were
  useEffect(() => {
    try {
      localStorage.setItem("gari_bazar_language", language);
    } catch (e) {}
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem("gari_bazar_active_tab", activeTab);
    } catch (e) {}
  }, [activeTab]);
  
  // Dashboard Sub-tab & Ad promotions center states
  const [dashboardSubTab, setDashboardSubTab] = useState<'inventory' | 'ads' | 'admin' | 'playstore-audit' | 'my-shop'>('inventory');
  
  // Seller Shop states
  const [activeSellerShopId, setActiveSellerShopId] = useState<string | null>(null);
  const [activeSellerShopFallback, setActiveSellerShopFallback] = useState<{
    name: string;
    photo?: string;
    location?: string;
    contact?: string;
  } | null>(null);

  // Current logged in user reviews for My Shop tab
  const [currentUserReviews, setCurrentUserReviews] = useState<any[]>([]);
  const [currentUserReviewsLoading, setCurrentUserReviewsLoading] = useState(false);
  const [selectedPromoPkg, setSelectedPromoPkg] = useState<any>(AD_PACKAGES[1]); // Default to Premium Promo package
  const [expandedAdPkgId, setExpandedAdPkgId] = useState<string | null>(null); // accordion: which ad package card is expanded
  const [adSelectedListingId, setAdSelectedListingId] = useState<string>("");
  const [adPromoLoading, setAdPromoLoading] = useState(false);
  const [adPromoSuccess, setAdPromoSuccess] = useState(false);
  const [adPromoError, setAdPromoError] = useState("");

  const [ownerPaymentInfo, setOwnerPaymentInfo] = useState({
    bkash: "01783457173 (Personal)",
    nagad: "01783457173 (Personal)",
    rocket: "01783457173 (Personal)"
  });
  
  // Firebase Auth states
  const [user, setUser] = useState<any>(null);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false);
  const [isMyShopSectionOpen, setIsMyShopSectionOpen] = useState(false); // eslint-disable-line -- kept for future use, no longer drives duplicate My Shop card
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [isTermsSectionOpen, setIsTermsSectionOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  
  // Support Form state
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSupportSubmitting, setIsSupportSubmitting] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  
  // Offline State Detector
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") || 
             localStorage.getItem("gari_bazar_theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("gari_bazar_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("gari_bazar_theme", "light");
      }
    }
  }, [isDark]);

  // Admin checking logic
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setIsAdminVerified(false);
      return;
    }
    const checkAdminStatus = async () => {
      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        setIsAdminVerified(adminDoc.exists());
      } catch (err) {
        setIsAdminVerified(false);
      }
    };
    checkAdminStatus();
  }, [user]);

  const isUserAdmin = isAdminVerified;
  
  // Helper to retrieve all currently blocked user IDs
  const getBlockedUids = (): string[] => {
    let localBlocked: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("gari_bazar_blocked_uids") || "[]";
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localBlocked = parsed;
        }
      } catch (e) {}
    }
    return [
      ...(userMetadata?.blockedUids || []),
      ...localBlocked
    ];
  };

  // Load initial listings from local localStorage + SAMPLE_LISTINGS immediately for instant rendering on startup
  const getInitialListings = (): PartListing[] => {
    const isProduction = checkIsProduction();
    
    let localListings: any[] = [];
    if (typeof window !== "undefined") {
      const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
      try {
        localListings = JSON.parse(localListingsStr);
      } catch (e) {}

      if (isProduction) {
        try {
          const cachedProd = localStorage.getItem("gari_bazar_prod_cached_listings");
          if (cachedProd) {
            const parsed = JSON.parse(cachedProd);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          }
        } catch (e) {}
        return [];
      }
    }

    const combined = [...localListings];
    SAMPLE_LISTINGS.forEach((item) => {
      if (!combined.some((dyn) => dyn.id === item.id)) {
        combined.push(item);
      }
    });

    // Sort by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Filter out blocked users
    let blockedUids: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("gari_bazar_blocked_uids") || "[]";
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          blockedUids = parsed;
        }
      } catch (e) {}
    }
    
    return combined.filter(item => !blockedUids.includes(item.sellerId)) as PartListing[];
  };

  // Core Database Listings State
  const [listings, setListings] = useState<PartListing[]>(getInitialListings);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Listings Pagination States
  const [firebaseListings, setFirebaseListings] = useState<PartListing[]>([]);
  const [moreListings, setMoreListings] = useState<PartListing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const [loadingMoreListings, setLoadingMoreListings] = useState(false);

  // Purchases Pagination States
  const [firebasePurchases, setFirebasePurchases] = useState<any[]>([]);
  const [morePurchases, setMorePurchases] = useState<any[]>([]);
  const [lastPurchasesDoc, setLastPurchasesDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMorePurchases, setHasMorePurchases] = useState(false);
  const [loadingMorePurchases, setLoadingMorePurchases] = useState(false);
  
  // UI Triggers & Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PartListing | null>(null);
  const [promotingListing, setPromotingListing] = useState<PartListing | null>(null);
  const [editingListing, setEditingListing] = useState<PartListing | null>(null);
  const [isStandalonePrivacy, setIsStandalonePrivacy] = useState(false);
  const [isStandaloneDeletion, setIsStandaloneDeletion] = useState(false);

  // Synchronize saved Listing IDs from localStorage when activeTab shifts or selectedListing toggles
  useEffect(() => {
    try {
      const favsStr = localStorage.getItem("gari_bazar_favorites") || "[]";
      const parsed = JSON.parse(favsStr);
      if (Array.isArray(parsed)) {
        setSavedListingIds(parsed);
      }
    } catch (e) {
      console.error("Error reading favorites:", e);
    }
  }, [activeTab, selectedListing]);

  // Dynamic bookmarks matching
  const savedListings = useMemo(() => {
    return listings.filter((item) => savedListingIds.includes(item.id));
  }, [listings, savedListingIds]);

  // Push Notifications (FCM) and Analytics integration states
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "default"
  );

  const prevListingsIdRef = useRef<Set<string>>(new Set());
  const sessionStartTimeRef = useRef<number>(Date.now());

  // 📲 PWA Install Prompt — একবার লগইন/রেজিস্টার করলে আর দেখানো হবে না
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const alreadyLoggedIn = !!localStorage.getItem("gari_bazar_session_user");
    const dismissedForever = localStorage.getItem("gari_bazar_install_dismissed") === "true";

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      if (!alreadyLoggedIn && !dismissedForever) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      localStorage.setItem("gari_bazar_install_dismissed", "true");
      setShowInstallPrompt(false);
      setDeferredInstallPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
    setShowInstallPrompt(false);
  };

  const dismissInstallPrompt = (forever: boolean) => {
    setShowInstallPrompt(false);
    if (forever) {
      localStorage.setItem("gari_bazar_install_dismissed", "true");
    }
  };

  // Check for incoming referral code from shared links
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get("ref");
      if (refCode) {
        localStorage.setItem("gari_bazar_prefilled_referral", refCode.toUpperCase());
        logger.debug("Captured prefilled referral code:", refCode);
      }
    }
  }, []);

  const showNotification = async (title: string, options: NotificationOptions) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration) {
            await registration.showNotification(title, options);
            return;
          }
        }
        new Notification(title, options);
      } catch (e) {
        console.warn("FCM push notification display failed:", e);
      }
    }
  };

  // Request Notification permission
  const handleRequestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      alert("Push notifications are not supported in this browser environment.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setShowNotificationPrompt(false);
      
      if (permission === "granted") {
        await showNotification("গাড়ি বাজার (Gari Bazar)", {
          body: language === "bn" 
            ? "পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে! আপনাকে স্বাগতম!" 
            : "Push notifications successfully enabled! Welcome aboard!",
          icon: "/src/assets/images/gari_bazar_icon_1781988192630.jpg"
        });
      }
    } catch (err) {
      console.warn("Could not request notification permission:", err);
    }
  };

  // Real-time listener for listings can check and trigger notifications
  useEffect(() => {
    if (listings.length === 0) return;
    
    // Extract listing IDs
    const currentIds = new Set(listings.map(l => l.id));
    
    // If we already had past listings, check if any brand new listing was added
    if (prevListingsIdRef.current.size > 0 && notificationPermission === "granted") {
      const addedListings = listings.filter(l => !prevListingsIdRef.current.has(l.id));
      
      // Notify for each newly added listing if it's from another seller
      // AND it was actually created after this session started (prevents Load More
      // pagination from re-triggering notifications for old, already-existing listings)
      addedListings.forEach(newListing => {
        const createdAtMs = newListing.createdAt ? new Date(newListing.createdAt).getTime() : 0;
        if (createdAtMs <= sessionStartTimeRef.current) return;
        if (newListing.sellerId !== user?.uid) {
          showNotification(language === "bn" ? "নতুন পার্টস বিক্রির বিজ্ঞাপন!" : "New Part Advert Listed!", {
            body: `🚗 ${newListing.title} - ৳${newListing.price.toLocaleString("en-IN")} (${newListing.location})`,
            icon: newListing.image || "/src/assets/images/gari_bazar_icon_1781988192630.jpg"
          });
        }
      });
    }
    
    // Update reference
    prevListingsIdRef.current = currentIds;
  }, [listings, notificationPermission, user?.uid, language]);

  // Searches & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const h = localStorage.getItem("gari_bazar_search_history");
      return h ? JSON.parse(h) : [];
    } catch {
      return [];
    }
  });

  const appendSearchHistory = (q: string) => {
    const clean = q.trim();
    if (!clean || clean.length < 2) return;
    setSearchHistory((prev) => {
      const next = [clean, ...prev.filter((x) => x !== clean)].slice(0, 6);
      localStorage.setItem("gari_bazar_search_history", JSON.stringify(next));
      return next;
    });
  };

  // Track search query analytics (Debounced)
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      logAnalyticsEvent("search", { query: searchQuery.trim() });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Track listing view analytics
  useEffect(() => {
    if (selectedListing) {
      logAnalyticsEvent("listing_view", {
        id: selectedListing.id,
        title: selectedListing.title,
        category: selectedListing.category,
        isAd: selectedListing.isAd ?? false
      });
    }
  }, [selectedListing]);

  // Parse path or query params for direct standalone Privacy Policy link
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const isPrivacyQuery = searchParams.get("view") === "privacy" || searchParams.get("page") === "privacy";
      const isPrivacyHash = window.location.hash === "#privacy";
      const isPrivacyPath = window.location.pathname.endsWith("/privacy");
      
      if (isPrivacyQuery || isPrivacyHash || isPrivacyPath) {
        setIsStandalonePrivacy(true);
      }

      const isDeleteQuery = searchParams.get("view") === "data-deletion" || searchParams.get("page") === "data-deletion" || searchParams.get("page") === "delete";
      const isDeleteHash = window.location.hash === "#data-deletion" || window.location.hash === "#delete";
      const isDeletePath = window.location.pathname.endsWith("/data-deletion") || window.location.pathname.endsWith("/delete");

      if (isDeleteQuery || isDeleteHash || isDeletePath) {
        setIsStandaloneDeletion(true);
      }
    }
  }, []);

  const activeTranslations = translations[language];

  // Ref to track if we pushed a modal state
  const modalHistoryRef = useRef<boolean>(false);

  // Intercept browser back button to close active modal instead of exiting the page/iframe
  useEffect(() => {
    const isAnyModalOpen = !!(isAuthOpen || selectedListing || promotingListing || editingListing || isRefillModalOpen || isLegalOpen);

    const handlePopState = () => {
      modalHistoryRef.current = false;
      setIsAuthOpen(false);
      setSelectedListing(null);
      setPromotingListing(null);
      setEditingListing(null);
      setIsRefillModalOpen(false);
      setIsLegalOpen(false);
    };

    if (isAnyModalOpen) {
      if (!modalHistoryRef.current) {
        window.history.pushState({ modalOpen: true }, "");
        modalHistoryRef.current = true;
      }
      window.addEventListener("popstate", handlePopState);
    } else {
      if (modalHistoryRef.current) {
        modalHistoryRef.current = false;
        window.history.back();
      }
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isAuthOpen, selectedListing, promotingListing]);

  // 1. Custom Passwordless Profile Authentication Listener & Real-time Firestore Sync
  useEffect(() => {
    // Read locally logged in profile on startup
    const stored = localStorage.getItem("gari_bazar_session_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser({
          uid: parsed.uid,
          displayName: parsed.displayName,
          email: parsed.email,
          photoURL: parsed.photoURL || parsed.profilePicture
        });
        setUserMetadata(parsed);
      } catch (err) {
        console.error("Local session parsing failed:", err);
      }
    }
  }, []);

  // Fetch dynamic payment info from database for the dashboard
  useEffect(() => {
    const docRef = doc(db, "settings", "payment_info");
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOwnerPaymentInfo({
          bkash: data.bkash || "01783457173 (Personal)",
          nagad: data.nagad || "01783457173 (Personal)",
          rocket: data.rocket || "01783457173 (Personal)"
        });
      }
    }, (err) => {
      console.warn("Dashboard using offline fallback/cached payment_info:", err.message);
    });
    return () => unsub();
  }, []);

  // Fetch reviews for the currently logged-in user to display in "My Shop"
  useEffect(() => {
    if (!user?.uid) {
      setCurrentUserReviews([]);
      return;
    }
    setCurrentUserReviewsLoading(true);
    const q = query(
      collection(db, "seller_reviews"),
      where("sellerId", "==", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCurrentUserReviews(list);
      setCurrentUserReviewsLoading(false);
    }, (err) => {
      console.warn("Failed to subscribe to current user reviews:", err);
      setCurrentUserReviewsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Sync profile metadata real-time (e.g. simulated credits recharge instantly)
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserMetadata((prev: any) => ({ ...prev, ...data }));
        
        // Sync back to local storage
        const stored = localStorage.getItem("gari_bazar_session_user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            localStorage.setItem("gari_bazar_session_user", JSON.stringify({ ...parsed, ...data }));
          } catch (e) {}
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Unread Chats Listener
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  useEffect(() => {
    if (!user?.uid) {
      setUnreadChatsCount(0);
      return;
    }
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const unreadForMe = data.unreadCount?.[user.uid] || 0;
        if (unreadForMe > 0) count++;
      });
      setUnreadChatsCount(count);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Paginated Listings Sync (using getDocs instead of global real-time onSnapshot)
  const fetchInitialListings = async () => {
    setLoading(true);
    const isProduction = checkIsProduction();
    try {
      const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(20));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        if (isProduction) {
          logger.debug("Firestore empty in production. No listings to show.");
          setFirebaseListings([]);
        } else {
          logger.debug("Firestore empty. Fallback to offline mock car parts listings.");
          setFirebaseListings(SAMPLE_LISTINGS as PartListing[]);
        }
        setHasMoreListings(false);
        setLastListingDoc(null);
      } else {
        const list: PartListing[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isDemo = docSnap.id.startsWith("local-") || docSnap.id.startsWith("temp-") || docSnap.id.startsWith("part-") || data.isDemo === true;
          if (!isProduction || !isDemo) {
            const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === "function"
              ? data.createdAt.toDate().toISOString()
              : data.createdAt;
            list.push({ id: docSnap.id, ...data, createdAt: normalizedCreatedAt } as PartListing);
          }
        });
        
        setFirebaseListings(list);
        setLastListingDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreListings(snapshot.docs.length === 20);
      }
    } catch (error) {
      console.error("Firestore loading error:", error);
      if (isProduction) {
        setFirebaseListings([]);
      } else {
        setFirebaseListings(SAMPLE_LISTINGS as PartListing[]);
      }
      setHasMoreListings(false);
      setLastListingDoc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialListings();

    const handleRefresh = () => {
      fetchInitialListings();
    };
    window.addEventListener("gari_bazar_refreshed_data", handleRefresh);
    return () => {
      window.removeEventListener("gari_bazar_refreshed_data", handleRefresh);
    };
  }, []);

  // 2b. Merge real-time, loaded-more, and local listings
  useEffect(() => {
    const processAndSetListings = (firebaseList: any[]) => {
      const isProduction = checkIsProduction();
      let localListings: any[] = [];
      if (!isProduction) {
        const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
        try {
          localListings = JSON.parse(localListingsStr);
        } catch (e) {}
      }

      // Combine local listings first
      const combined = [...localListings];
      firebaseList.forEach((item) => {
        if (!combined.some((dyn) => dyn.id === item.id)) {
          combined.push(item);
        }
      });
      
      // Sort by createdAt descending
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Filter out blocked users
      const blocked = getBlockedUids();
      let filtered = combined.filter(item => !blocked.includes(item.sellerId));

      // Filter out demo/sample/mock listings in production
      if (isProduction) {
        filtered = filtered.filter(item => {
          const isDemo = item.id.startsWith("local-") || item.id.startsWith("temp-") || item.id.startsWith("part-") || item.isDemo === true;
          return !isDemo;
        });

        // Cache production listings in local storage for instant loading on subsequent mounts
        if (typeof window !== "undefined" && filtered.length > 0) {
          try {
            localStorage.setItem("gari_bazar_prod_cached_listings", JSON.stringify(filtered));
          } catch (e) {}
        }
      }

      setListings(filtered);
    };

    const combinedList = [...firebaseListings, ...moreListings];
    processAndSetListings(combinedList);

    const handleLocalSync = () => {
      processAndSetListings([...firebaseListings, ...moreListings]);
    };
    window.addEventListener("storage", handleLocalSync);

    return () => {
      window.removeEventListener("storage", handleLocalSync);
    };
  }, [firebaseListings, moreListings, userMetadata?.blockedUids]);

  // 2c. Listings Pagination Loader helper
  const handleLoadMoreListings = async () => {
    if (!lastListingDoc || loadingMoreListings) return;
    setLoadingMoreListings(true);
    try {
      const q = query(
        collection(db, "listings"),
        orderBy("createdAt", "desc"),
        startAfter(lastListingDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setHasMoreListings(false);
      } else {
        const nextList: PartListing[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const normalizedCreatedAt = data.createdAt && typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : data.createdAt;
          nextList.push({ id: doc.id, ...data, createdAt: normalizedCreatedAt } as PartListing);
        });
        
        setMoreListings(prev => {
          const combined = [...prev];
          nextList.forEach(item => {
            if (!combined.some(existing => existing.id === item.id)) {
              combined.push(item);
            }
          });
          return combined;
        });
        setLastListingDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreListings(snapshot.docs.length === 20);
      }
    } catch (err) {
      console.warn("Failed to load more listings:", err);
    } finally {
      setLoadingMoreListings(false);
    }
  };

  // 3. Real-time Purchases Sync (capped to 20 documents)
  useEffect(() => {
    if (!user) {
      setFirebasePurchases([]);
      setMorePurchases([]);
      setLastPurchasesDoc(null);
      setHasMorePurchases(false);
      return;
    }

    const q = query(collection(db, "purchases"), where("buyerId", "==", user.uid), orderBy("createdAt", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setFirebasePurchases([]);
        setLastPurchasesDoc(null);
        setHasMorePurchases(false);
      } else {
        const firestoreList: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.buyerId === user.uid || data.sellerContact === userMetadata?.phoneNumber) {
            firestoreList.push({ id: doc.id, ...data });
          }
        });

        setFirebasePurchases(firestoreList);
        setLastPurchasesDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMorePurchases(snapshot.docs.length === 20);
      }
    }, (err) => {
      console.warn("Using offline purchases:", err);
    });

    return () => {
      unsubscribe();
    };
  }, [user, userMetadata?.phoneNumber]);

  // 3b. Merge real-time, loaded-more, and local purchases
  useEffect(() => {
    const loadLocal = () => {
      const stored = localStorage.getItem("gari_bazar_local_purchases") || "[]";
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [];
      }
    };

    const processAndSetPurchases = (firebaseList: any[]) => {
      // Merge Firestore items with local items (to prevent duplicates by title+createdAt or id)
      const merged = [...firebaseList];
      const currentLocal = loadLocal();
      currentLocal.forEach((localItem: any) => {
        const alreadyExists = merged.some(
          (item) => 
            item.id === localItem.id || 
            (item.title === localItem.title && 
             Math.abs(new Date(item.createdAt).getTime() - new Date(localItem.createdAt).getTime()) < 30000)
        );
        if (!alreadyExists) {
          merged.push(localItem);
        }
      });

      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPurchases(merged);
    };

    const combinedPurchases = [...firebasePurchases, ...morePurchases];
    processAndSetPurchases(combinedPurchases);

    const handleLocalSync = (e: StorageEvent) => {
      if (e.key === "gari_bazar_local_purchases" || !e.key) {
        processAndSetPurchases([...firebasePurchases, ...morePurchases]);
      }
    };

    window.addEventListener("storage", handleLocalSync);

    return () => {
      window.removeEventListener("storage", handleLocalSync);
    };
  }, [firebasePurchases, morePurchases]);

  // 3c. Purchases Pagination Loader helper
  const handleLoadMorePurchases = async () => {
    if (!user || !lastPurchasesDoc || loadingMorePurchases) return;
    setLoadingMorePurchases(true);
    try {
      const q = query(
        collection(db, "purchases"),
        orderBy("createdAt", "desc"),
        startAfter(lastPurchasesDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setHasMorePurchases(false);
      } else {
        const nextList: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.buyerId === user.uid || data.sellerContact === userMetadata?.phoneNumber) {
            nextList.push({ id: doc.id, ...data });
          }
        });

        setMorePurchases(prev => {
          const combined = [...prev];
          nextList.forEach(item => {
            if (!combined.some(existing => existing.id === item.id)) {
              combined.push(item);
            }
          });
          return combined;
        });

        setLastPurchasesDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMorePurchases(snapshot.docs.length === 20);
      }
    } catch (err) {
      console.warn("Failed to load more purchases:", err);
    } finally {
      setLoadingMorePurchases(false);
    }
  };

  // 3b. Expired Ad Promotion Resetter & Delete / Edit Helpers
  useEffect(() => {
    if (listings.length === 0) return;
    
    // Check if any listings contains an expired advertisement
    const expiredAds = listings.filter(
      (item) => item.isAd && item.adExpiresAt && new Date(item.adExpiresAt).getTime() < Date.now()
    );

    if (expiredAds.length > 0) {
      logger.debug(`Resetting ${expiredAds.length} expired ad promotions...`);
      expiredAds.forEach(async (item) => {
        try {
          const isLocal = item.id.startsWith("local-") || item.id.startsWith("temp-");
          if (isLocal) {
            const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
            let localListings: any[] = [];
            try {
              localListings = JSON.parse(localListingsStr);
            } catch (e) {}

            const updated = localListings.map((l) =>
              l.id === item.id ? { ...l, isAd: false, adExpiresAt: null } : l
            );
            localStorage.setItem("gari_bazar_local_listings", JSON.stringify(updated));
            window.dispatchEvent(new Event("storage"));
          } else {
            const listingRef = doc(db, "listings", item.id);
            await updateDoc(listingRef, {
              isAd: false,
              adExpiresAt: null
            });
          }
        } catch (err) {
          console.error("Error resetting expired advertisement promotion:", err);
        }
      });
    }
  }, [listings]);

  const handleDeleteListingBySeller = async (itemId: string) => {
    const confirmDelete = window.confirm(
      language === "bn" 
        ? "আপনি কি নিশ্চিত যে আপনি স্থায়ীভাবে এই বিজ্ঞাপনটি মুছে ফেলতে চান?" 
        : "Are you sure you want to permanently delete this listing?"
    );
    if (!confirmDelete) return;

    try {
      const isLocal = itemId.startsWith("local-") || itemId.startsWith("temp-");
      if (isLocal) {
        const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
        let localListings: any[] = [];
        try {
          localListings = JSON.parse(localListingsStr);
        } catch (e) {}

        const updated = localListings.filter(item => item.id !== itemId);
        localStorage.setItem("gari_bazar_local_listings", JSON.stringify(updated));
        
        // Dispatch local event to refresh state
        window.dispatchEvent(new Event("storage"));
      } else {
        await deleteDoc(doc(db, "listings", itemId));
      }
    } catch (err) {
      console.error("Error deleting listing:", err);
      alert(language === "bn" ? "মুছে ফেলতে ব্যর্থ হয়েছে" : "Failed to delete listing.");
    }
  };

  // 4. Quick simulated Recharge Wallet budget
  const handleRechargeWallet = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setIsRefillModalOpen(true);
  };

  // 4a. Launch Ad Campaign directly from user dashboard
  const handleDashboardPromoSubmit = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!adSelectedListingId) {
      setAdPromoError(language === "bn" ? "দয়া করে বিজ্ঞাপন দেয়ার জন্য একটি প্রোডাক্ট সিলেক্ট করুন" : "Please select a product to advertise");
      return;
    }
    if (!selectedPromoPkg) {
      setAdPromoError(language === "bn" ? "দয়া করে একটি সাবস্ক্রিপশন প্যাকেজ সিলেক্ট করুন" : "Please select a subscription package");
      return;
    }

    setAdPromoLoading(true);
    setAdPromoError("");
    setAdPromoSuccess(false);

    try {
      const targetListing = listings.find(item => item.id === adSelectedListingId);
      if (!targetListing) {
        throw new Error("Listing not found");
      }

      // 1. Create a pending refill_request — the UddoktaPay webhook verifies
      //    payment and activates the ad automatically. No TxID needed.
      const docData = {
        userId: user.uid,
        userName: user.displayName || "Seller",
        userEmail: user.email || "",
        amount: Number(selectedPromoPkg.price),
        status: "pending",
        type: "ad_promotion",
        listingId: targetListing.id,
        listingTitle: targetListing.title,
        adTier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        currentViews: targetListing.views || 0,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "refill_requests"), docData);

      // 2. Ask our server to open a real UddoktaPay checkout session for this request.
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/payment/create-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ requestId: docRef.id })
      });
      const data = await res.json();

      if (!res.ok || !data.payment_url) {
        throw new Error(data.error || (language === "bn" ? "পেমেন্ট গেটওয়ে শুরু করা যায়নি।" : "Could not start the payment gateway."));
      }

      // Track Analytics ad promo
      logAnalyticsEvent("ad_promote", {
        listingId: targetListing.id,
        title: targetListing.title,
        tier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        pricePaid: selectedPromoPkg.price,
        isInstant: false
      });

      // 3. Send the user to the real UddoktaPay checkout page.
      //    On successful payment, the webhook activates the ad automatically.
      window.location.href = data.payment_url;

    } catch (err: any) {
      console.error("Dashboard campaign launch error:", err);
      setAdPromoError(
        err?.message || (language === "bn"
          ? "বিজ্ঞাপন তৈরি ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।"
          : "Campaign initialization failed. Please retry.")
      );
      setAdPromoLoading(false);
    }
  };

  // 5. Track views asynchronously when user reviews details
  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);
    
    try {
      const listingRef = doc(db, "listings", listing.id);
      const newViews = (listing.views || 0) + 1;
      await updateDoc(listingRef, {
        views: newViews
      });
      // Reflect the new view count immediately in local state so the
      // updated number shows right away without needing an app reload.
      setListings((prev) =>
        prev.map((item) =>
          item.id === listing.id ? { ...item, views: newViews } : item
        )
      );
      setSelectedListing((prev) =>
        prev && prev.id === listing.id ? { ...prev, views: newViews } : prev
      );
    } catch (err) {
      console.warn("Could not increment view counter:", err);
    }
  };

  // 6. Sign out trigger
  const handleLogout = () => {
    signOut(auth).catch((err) => console.warn("Firebase signOut failed:", err));
    localStorage.removeItem("gari_bazar_session_user");
    setUser(null);
    setUserMetadata(null);
    setActiveTab("market");
  };

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

  // 7. Filtering listings based on user queries using Fuse.js fuzzy & bilingual aliases
  // TODO: Server-Side Search Note (Algolia/Typesense)
  // Because public listings are now fetched with pagination via paginated getDocs, client-side Fuse.js
  // only filters pages currently loaded in memory. For global searching across thousands of remote
  // listings in production, replace client fuzzy search with Algolia, Typesense, or Firebase Firestore Search extensions (e.g. Algolia Integration)
  // that queries a server-side indexed corpus on the backend.
  const enrichedListings = useMemo(() => {
    return listings.map((item) => {
      const cat = CATEGORIES.find(c => c.id === item.category);
      const categoryLabelEn = cat ? cat.labelEn : "";
      const categoryLabelBn = cat ? cat.labelBn : "";
      
      const searchBlob = buildSearchBlob([
        item.title,
        item.brand || "",
        item.model,
        item.description,
        item.category,
        categoryLabelEn,
        categoryLabelBn,
        item.location
      ]);
      
      return {
        ...item,
        searchBlob
      };
    });
  }, [listings]);

  const fuseInstance = useMemo(() => {
    return new Fuse(enrichedListings, {
      keys: [
        { name: "title", weight: 0.4 },
        { name: "model", weight: 0.3 },
        { name: "searchBlob", weight: 0.3 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }, [enrichedListings]);

  const filteredListings = useMemo(() => {
    let baseListings = enrichedListings;
    
    if (searchQuery.trim().length > 0) {
      const queryLower = searchQuery.toLowerCase();
      const queryEnglishDigits = convertBengaliDigitsToEnglish(queryLower);
      const queryBengaliDigits = convertEnglishDigitsToBengali(queryLower);
      
      // Also generate individual word tokens to support multi-word fallback
      const words = queryLower.split(/\s+/).filter(w => w.trim().length > 1);
      const engWords = words.map(w => convertBengaliDigitsToEnglish(w));
      const bngWords = words.map(w => convertEnglishDigitsToBengali(w));

      // Bangla<->English phonetic key, so "gari" finds Bengali posts and vice versa
      const queryPhonetic = toPhoneticKey(queryLower);
      const phoneticWords = words.map(w => toPhoneticKey(w));
      
      const searchOptions = Array.from(new Set([
        queryLower,
        queryEnglishDigits,
        queryBengaliDigits,
        queryLower.replace(/\s+/g, ""),
        queryEnglishDigits.replace(/\s+/g, ""),
        queryBengaliDigits.replace(/\s+/g, ""),
        queryPhonetic,
        queryPhonetic.replace(/\s+/g, ""),
        ...words,
        ...engWords,
        ...bngWords,
        ...phoneticWords
      ])).filter(Boolean);
      
      let matchedItems: any[] = [];
      const seenIds = new Set<string>();
      
      // Word-boundary aware substring check. Plain alphabetic queries (real
      // words like "car", "bus", "cat") require a true word boundary so they
      // don't match inside unrelated words like "cargo" or "carefully" -
      // alphanumeric/model-style queries (like "320", "e70") keep the old
      // loose substring behavior since that's needed for "320" -> "320B".
      const isPureAlpha = (s: string) => /^[a-z]+$/i.test(s) || /^[\u0980-\u09FF]+$/.test(s);
      const smartIncludes = (haystack: string, needle: string): boolean => {
        if (!needle) return false;
        if (!isPureAlpha(needle)) return haystack.includes(needle);
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const boundary = "[^a-zA-Z\\u0980-\\u09FF]";
        const re = new RegExp(`(^|${boundary})${escaped}($|${boundary})`, "i");
        return re.test(haystack);
      };

      // 1. Direct Case-Insensitive Substring matches - highly precise & reliable for short numbers (like '320' -> '320 B')
      for (const item of enrichedListings) {
        const titleLoc = (item.title || "").toLowerCase();
        const brandLoc = (item.brand || "").toLowerCase();
        const modelLoc = (item.model || "").toLowerCase();
        const descLoc = (item.description || "").toLowerCase();
        const blobLoc = (item.searchBlob || "").toLowerCase();
        
        let isDirectMatch = false;
        for (const opt of searchOptions) {
          const optLower = opt.toLowerCase();
          if (
            smartIncludes(titleLoc, optLower) ||
            smartIncludes(brandLoc, optLower) ||
            smartIncludes(modelLoc, optLower) ||
            smartIncludes(descLoc, optLower) ||
            smartIncludes(blobLoc, optLower)
          ) {
            isDirectMatch = true;
            break;
          }
        }
        
        if (isDirectMatch) {
          seenIds.add(item.id);
          matchedItems.push(item);
        }
      }
      
      // 2. Fuzzy fallback matching via Fuse.js
      // Skip very short tokens (<= 3 chars) here - fuzzy edit-distance matching
      // on short strings is too imprecise (e.g. "car" ~ "cat") and causes
      // false positives like a "Car" search pulling in every CAT-branded
      // excavator listing. Exact substring matching above already covers
      // short exact terms reliably.
      for (const q of searchOptions) {
        if (!q.trim() || q.trim().length <= 3) continue;
        const results = fuseInstance.search(q);
        for (const res of results) {
          if (!seenIds.has(res.item.id)) {
            seenIds.add(res.item.id);
            matchedItems.push(res.item);
          }
        }
      }
      
      baseListings = matchedItems;
    }
    
    // Filter matching categories and geographic cities
    const finalFiltered = baseListings.filter((item) => {
      // 1. Parent category filter
      let matchesCategory = true;
      const isVehicle = isItemVehicle(item);
      if (selectedCategory === "vehicles") {
        matchesCategory = isVehicle;
      } else if (selectedCategory === "spare_parts") {
        matchesCategory = !isVehicle;
      }

      // 2. Sub-category filter
      let matchesSub = true;
      if (selectedSubCategory !== "all") {
        const matchesField = item.subCategory === selectedSubCategory || item.category === selectedSubCategory;
        
        let matchesText = false;
        const textToSearch = (item.title + " " + item.description).toLowerCase();
        
        if (selectedSubCategory === "excavator") {
          matchesText = textToSearch.includes("excavator") || textToSearch.includes("এক্সক্যাভেটর") || textToSearch.includes("এক্সকাভেটর");
        } else if (selectedSubCategory === "crane") {
          matchesText = textToSearch.includes("crane") || textToSearch.includes("ক্রেন");
        } else if (selectedSubCategory === "car") {
          matchesText = textToSearch.includes("car") || textToSearch.includes("কার") || textToSearch.includes("toyota") || textToSearch.includes("jeep") || textToSearch.includes("pickup") || textToSearch.includes("noah") || textToSearch.includes("hilux");
        } else if (selectedSubCategory === "bus") {
          matchesText = textToSearch.includes("bus") || textToSearch.includes("বাস");
        } else if (selectedSubCategory === "bulldozer") {
          matchesText = textToSearch.includes("bulldozer") || textToSearch.includes("বুলডোজার") || textToSearch.includes("dozer");
        } else if (selectedSubCategory === "forklift") {
          matchesText = textToSearch.includes("forklift") || textToSearch.includes("ফর্কলিফ্ট") || textToSearch.includes("forkclip");
        } else if (selectedSubCategory === "other_heavy_equipment") {
          matchesText = textToSearch.includes("heavy") || textToSearch.includes("loader") || textToSearch.includes("পল্লক") || textToSearch.includes("pulle");
        } else if (selectedSubCategory === "engine_part") {
          matchesText = textToSearch.includes("engine") || textToSearch.includes("ইঞ্জিন") || textToSearch.includes("cylinder") || textToSearch.includes("sleeve") || textToSearch.includes("gear") || textToSearch.includes("transmission") || textToSearch.includes("গিয়ার") || textToSearch.includes("chain") || textToSearch.includes("চেইন");
        } else if (selectedSubCategory === "light") {
          matchesText = textToSearch.includes("light") || textToSearch.includes("লাইট") || textToSearch.includes("bulb") || textToSearch.includes("বডি");
        } else if (selectedSubCategory === "pump") {
          matchesText = textToSearch.includes("pump") || textToSearch.includes("পাম্প") || textToSearch.includes("hydraulic") || textToSearch.includes("হাইড্রলিক");
        } else if (selectedSubCategory === "controller") {
          matchesText = textToSearch.includes("controller") || textToSearch.includes("কন্ট্রোলার");
        } else if (selectedSubCategory === "drive_motor") {
          matchesText = textToSearch.includes("motor") || textToSearch.includes("মোটর") || textToSearch.includes("drive");
        } else if (selectedSubCategory === "other_part") {
          matchesText = true;
        }
        
        matchesSub = matchesField || matchesText;
      }

      const matchesCity = selectedCity === "all" || item.location.includes(selectedCity.split(" ")[0]);
      return matchesCategory && matchesSub && matchesCity;
    });

    // Custom sorting algorithms
    return [...finalFiltered].sort((a, b) => {
      // Prioritize boosted promoted spotlight ad listings
      if (a.isAd && !b.isAd) return -1;
      if (!a.isAd && b.isAd) return 1;

      if (sortBy === "priceAsc") {
        return a.price - b.price;
      } else if (sortBy === "priceDesc") {
        return b.price - a.price;
      } else if (sortBy === "popularity") {
        const popA = (a.views || 0) + (a.clicks || 0) * 3;
        const popB = (b.views || 0) + (b.clicks || 0) * 3;
        return popB - popA;
      } else {
        // "latest"
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [enrichedListings, fuseInstance, searchQuery, selectedCategory, selectedSubCategory, selectedCity, sortBy]);

  // 8. Stats counting
  const statsSummary = useMemo(() => {
    const activeCount = listings.length;
    const totalViews = listings.reduce((sum, item) => sum + (item.views || 0), 0);
    const activeAdsCount = listings.filter((item) => item.isAd).length;
    const totalOrderValue = purchases.reduce((sum, item) => sum + item.price, 0);

    return { activeCount, totalViews, activeAdsCount, totalOrderValue };
  }, [listings, purchases]);

  if (isStandalonePrivacy) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
        <PrivacyPolicyPage 
          language={language}
          standalone={true}
          onBack={() => {
            setIsStandalonePrivacy(false);
            if (typeof window !== "undefined" && window.history.pushState) {
              const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
              window.history.pushState({ path: cleanUrl }, "", cleanUrl);
            }
          }}
        />
      </Suspense>
    );
  }

  if (isStandaloneDeletion) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
        <DataDeletionPage
          language={language}
          standalone={true}
          onBack={() => {
            setIsStandaloneDeletion(false);
            if (typeof window !== "undefined" && window.history.pushState) {
              const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
              window.history.pushState({ path: cleanUrl }, "", cleanUrl);
            }
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Offline Alert Banner in Bengali */}
      {isOffline && (
        <div className="bg-red-600 text-white font-bold text-[13px] py-2.5 px-4 flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
          <span>⚠️ আপনি এখন অফলাইনে আছেন। কিছু ফিচার ঠিকমতো কাজ নাও করতে পারে। (Offline Mode)</span>
        </div>
      )}
      
      <HeaderNav
        language={language}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        unreadChatsCount={unreadChatsCount}
        setIsAuthOpen={setIsAuthOpen}
        navDashboardLabel={activeTranslations.navDashboard}
        navSellLabel={activeTranslations.navSell}
      />

      {/* 4. MAIN LAYOUT AND CORE VIEWS */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-2.5 sm:px-4 md:px-6 lg:px-8 pt-0.5 pb-24 md:pt-4 md:pb-8">
        
        {loading && listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
            <p className="text-slate-500 font-medium text-sm">
              {language === "bn" ? "গাড়ি বাজার লোড হচ্ছে..." : "Loading Gari Bazar..."}
            </p>
          </div>
        ) : (
          <div>
            {loading && listings.length > 0 && (
              <div className="w-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold py-1.5 px-3 rounded-xl mb-3 flex items-center justify-between gap-2 animate-pulse">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {language === "bn" ? "সার্ভার থেকে নতুন ডেটা লোড হচ্ছে..." : "Loading fresh listings from server..."}
                </span>
              </div>
            )}
            
            {/* TAB 1: MARKETPLACE */}
            {/* TAB 1: MARKETPLACE */}
            {activeTab === 'market' && (
              <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                <MarketplaceTab
                  language={language}
                  activeTranslations={activeTranslations}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  appendSearchHistory={appendSearchHistory}
                  searchHistory={searchHistory}
                  setSearchHistory={setSearchHistory}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedSubCategory={selectedSubCategory}
                  setSelectedSubCategory={setSelectedSubCategory}
                  selectedCity={selectedCity}
                  setSelectedCity={setSelectedCity}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  listings={listings}
                  filteredListings={filteredListings}
                  hasMoreListings={hasMoreListings}
                  loadingMoreListings={loadingMoreListings}
                  handleLoadMoreListings={handleLoadMoreListings}
                  handleViewListingDetails={handleViewListingDetails}
                  isUserAdmin={isUserAdmin}
                  user={user}
                  setIsAuthOpen={setIsAuthOpen}
                  setPromotingListing={setPromotingListing}
                  setActiveTab={setActiveTab}
                  showInstallPrompt={showInstallPrompt}
                  handleInstallApp={handleInstallApp}
                  dismissInstallPrompt={dismissInstallPrompt}
                  showNotificationPrompt={showNotificationPrompt}
                  setShowNotificationPrompt={setShowNotificationPrompt}
                  notificationPermission={notificationPermission}
                  handleRequestNotificationPermission={handleRequestNotificationPermission}
                />
              </Suspense>
            )}

            {/* TAB 2: POST / SELL */}
            {activeTab === 'sell' && (
              <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                <AddPartForm 
                  language={language}
                  currentUser={userMetadata}
                  onPostSuccess={() => {
                    setActiveTab("market");
                  }}
                  onLoginPrompt={() => {
                    setIsAuthOpen(true);
                  }}
                  onViewListing={handleViewListingDetails}
                />
              </Suspense>
            )}

            {/* TAB 3: USER DASHBOARD & TRACKING DESK */}
            {activeTab === 'my-dashboard' && user && (
              <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                <DashboardTab
                  language={language}
                  activeTranslations={activeTranslations}
                  setActiveTab={setActiveTab}
                  user={user}
                  userMetadata={userMetadata}
                  isUserAdmin={isUserAdmin}
                  listings={listings}
                  purchases={purchases}
                  hasMorePurchases={hasMorePurchases}
                  loadingMorePurchases={loadingMorePurchases}
                  handleLoadMorePurchases={handleLoadMorePurchases}
                  handleDeleteListingBySeller={handleDeleteListingBySeller}
                  handleViewListingDetails={handleViewListingDetails}
                  setEditingListing={setEditingListing}
                  dashboardSubTab={dashboardSubTab}
                  setDashboardSubTab={setDashboardSubTab}
                  currentUserReviews={currentUserReviews}
                  currentUserReviewsLoading={currentUserReviewsLoading}
                  selectedPromoPkg={selectedPromoPkg}
                  setSelectedPromoPkg={setSelectedPromoPkg}
                  expandedAdPkgId={expandedAdPkgId}
                  setExpandedAdPkgId={setExpandedAdPkgId}
                  adSelectedListingId={adSelectedListingId}
                  setAdSelectedListingId={setAdSelectedListingId}
                  adPromoLoading={adPromoLoading}
                  adPromoSuccess={adPromoSuccess}
                  setAdPromoSuccess={setAdPromoSuccess}
                  adPromoError={adPromoError}
                  setAdPromoError={setAdPromoError}
                  handleDashboardPromoSubmit={handleDashboardPromoSubmit}
                />
              </Suspense>
            )}

            {/* TAB: CHAT / MESSAGES */}
            {activeTab === 'chats' && (
              <div className="animate-fade-in">
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>}>
                  <ChatView
                    currentUser={user}
                    language={language}
                    onLoginPrompt={() => setIsAuthOpen(true)}
                    initialListingToChat={initialListingToChat}
                    onClearInitialListing={() => setInitialListingToChat(null)}
                  />
                </Suspense>
              </div>
            )}

            {/* TAB: SAVED BOOKMARKS */}
            {activeTab === 'saved' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-850 dark:text-white flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-500" />
                      {language === "bn" ? "আমার পছন্দের তালিকা ও বুকমার্ক" : "My Bookmarked Ads"}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">
                      {language === "bn" 
                        ? "আপনার সেভ করে রাখা খুচরা যন্ত্রাংশ এবং গাড়ির বিজ্ঞাপনসমূহ এখানে দেখতে পাবেন।" 
                        : "Browse vehicle accessories and heavy equipments you have saved for later."}
                    </p>
                  </div>
                </div>

                {savedListings.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-850 rounded-3xl p-12 text-center text-slate-400 dark:text-slate-500 max-w-md mx-auto space-y-4 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
                        {language === "bn" ? "কোনো বুকমার্ক পাওয়া যায়নি" : "No saved items yet"}
                      </p>
                      <p className="text-xs text-slate-450 mt-1">
                        {language === "bn" 
                          ? "মার্কেটপ্লেস থেকে যেকোনো লিস্টিংয়ের বুকমার্ক আইকনে ক্লিক করে এখানে সেভ করে রাখতে পারেন।" 
                          : "Explore auto parts or vehicle advertisements and tap the bookmark icon to save them here."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("market")}
                      className="inline-flex bg-gradient-to-r from-amber-500 to-orange-550 text-slate-950 font-black text-xs py-2.5 px-6 rounded-xl cursor-pointer"
                    >
                      {language === "bn" ? "মার্কেটপ্লেসে যান" : "Browse Marketplace"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4 animate-fade-in">
                    {savedListings.map((listing) => (
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
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="animate-fade-in max-w-xl mx-auto space-y-5">
                
                {/* A. Top left corner Logo & Branding with "Profile" */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-r from-orange-550 to-amber-500 text-slate-950 font-black flex items-center justify-center shadow-md text-lg sm:text-xl select-none shrink-0">
                      গ
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-black text-slate-850 dark:text-white leading-none">
                          {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
                        </h2>
                        <span className="text-[10px] sm:text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg select-none">
                          {language === "bn" ? "প্রোফাইল" : "Profile"}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                        {language === "bn" ? "পার্টস ও গাড়ি বেচাকেনা" : "Auto Parts & Vehicles Trading"}
                      </p>
                    </div>
                  </div>
                </div>

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
                                  {user.email || (language === "bn" ? "ইমেইল প্রদান করা হয়নি" : "No email linked")}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 text-xs pt-1">
                              <div className="bg-white dark:bg-slate-900 border border-slate-150/80 dark:border-slate-800 p-2.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-400 font-bold uppercase block">
                                  {language === "bn" ? "ফোন নম্বর" : "Phone Number"}
                                </span>
                                <span className="font-extrabold text-slate-750 dark:text-slate-205 block mt-0.5 font-mono">
                                  {userMetadata?.phoneNumber || user?.phoneNumber || "—"}
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
                                ? "গাড়ি বাজার অ্যাপে লগইন করতে দয়া করে নিচের বাটনে চাপুন।" 
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

                  {/* Row 1.5: My Shop (আমার দোকান) — এখন শুধু Dashboard-এ navigate করে, ডুপ্লিকেট কার্ড নেই */}
                  <div className="transition duration-150">
                    <button
                      type="button"
                      id="profile-row-myshop"
                      onClick={() => {
                        if (!user) {
                          setIsAuthOpen(true);
                          return;
                        }
                        setActiveTab("my-dashboard");
                        setDashboardSubTab("my-shop");
                      }}
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
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </button>
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
                            {language === "bn" ? "আমাদের টিম ও গাড়ি বাজার" : "Our Team & About"}
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
                              ? "গাড়ি বাজার অ্যাপটি বাংলাদেশে অটো পার্টস ও খুচরা যন্ত্রাংশের বেচাকেনাকে সহজ এবং ডিজিটাল করতে তৈরি করা হয়েছে। আমাদের মূল লক্ষ্য গ্রাহকদের নিরাপদ ও বিশ্বস্ত সেবা প্রদান করা।"
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
                            <span>{language === "bn" ? "প্লে স্টোর নীতিমালায় সংগতি" : "Fully Play Store Compliant"}</span>
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
                                  ? "আপনার মেসেজটি সফলভাবে টিমের কাছে পাঠানো হয়েছে! ২৪ ঘণ্টার মধ্যে যোগাযোগ করা হবে।" 
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
                                    placeholder={user?.displayName || (language === "bn" ? "যেমন: রায়হান" : "e.g. Rayhan")}
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
            )}

          </div>
        )}

      </main>

      {/* 5. Footer with credit/disclaimers - Profile tab only */}
      {activeTab === 'profile' && (
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-8 pb-28 md:pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-slate-300 font-bold">
            <Car className="w-4 h-4 text-amber-500" />
            <span>{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-400">
            {language === "bn" 
              ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
              : "Bangladesh's premium online car parts marketplace. Boost your listings with secure, real-time sponsored ad placements."}
          </p>
          <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
            <span>© 2026 Gari Bazar Tech</span>
            <span>•</span>
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
            >
              {language === "bn" ? "🔒 আইনি পলিসি ও প্রাইভেসি কেন্দ্র" : "🔒 Legal Policies & Privacy Hub"}
            </button>
          </div>
        </div>
      </footer>
      )}

      {/* All interactive floating dialogs & Modals */}
      <Suspense fallback={null}>
      
      {/* 1. Auth Modals */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)}
        language={language}
        onAuthSuccess={(sessionUser) => {
          setUser({
            uid: sessionUser.uid,
            displayName: sessionUser.displayName,
            email: sessionUser.email,
            photoURL: sessionUser.photoURL || sessionUser.profilePicture
          });
          setUserMetadata(sessionUser);
          setIsAuthOpen(false);
          dismissInstallPrompt(true);
        }}
      />

      {/* 2. Listing Details walk thoughts */}
      {selectedListing && (
        <ListingDetailModal 
          listing={selectedListing}
          language={language}
          currentUser={userMetadata || user}
          onClose={() => setSelectedListing(null)}
          onPurchaseAdded={() => {
            // updates purchases data automatically via firestore listener
          }}
          onLoginPrompt={() => {
            setSelectedListing(null);
            setIsAuthOpen(true);
          }}
          onInitiateSellerChat={(listingToChat) => {
            setInitialListingToChat(listingToChat);
            setSelectedListing(null);
            setActiveTab("chats");
          }}
          onViewSellerShop={(sellerId, fallbackName, fallbackPhoto, fallbackLocation, fallbackContact) => {
            setActiveSellerShopId(sellerId);
            setActiveSellerShopFallback({
              name: fallbackName,
              photo: fallbackPhoto,
              location: fallbackLocation,
              contact: fallbackContact
            });
          }}
        />
      )}

      {/* 3. Promote listings active ad selector */}
      {promotingListing && (
        <PromoteAdModal 
          listing={promotingListing}
          language={language}
          currentUser={user}
          onClose={() => setPromotingListing(null)}
          onPromotionSuccess={() => {
            // listing gets updated automatically via listener hook
          }}
        />
      )}

      {/* 4. Refill Ad Budget Wallet */}
      <RefillModal
        isOpen={isRefillModalOpen}
        onClose={() => setIsRefillModalOpen(false)}
        currentUser={userMetadata || user}
        language={language}
      />

      {/* 6. Edit Listing Modal for Sellers */}
      <EditListingModal
        isOpen={!!editingListing}
        onClose={() => setEditingListing(null)}
        listing={editingListing}
        language={language}
        onSaveSuccess={() => {
          // listings get updated automatically via firestore or local triggers
        }}
      />

      {/* 7. Legal Hub Compliance Modal */}
      <LegalHubModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
        language={language}
      />

      {/* Seller Shop Page Modal Overlay */}
      {activeSellerShopId && (
        <SellerShopPage
          sellerId={activeSellerShopId}
          fallbackSellerName={activeSellerShopFallback?.name}
          fallbackSellerPhoto={activeSellerShopFallback?.photo}
          fallbackLocation={activeSellerShopFallback?.location}
          fallbackContact={activeSellerShopFallback?.contact}
          language={language}
          currentUser={user}
          onClose={() => setActiveSellerShopId(null)}
          onViewListingDetails={(listing) => {
            handleViewListingDetails(listing);
          }}
          onInitiateSellerChat={(listing) => {
            setInitialListingToChat(listing);
            setActiveSellerShopId(null);
            setSelectedListing(null);
            setActiveTab("chats");
          }}
          onLoginPrompt={() => {
            setActiveSellerShopId(null);
            setIsAuthOpen(true);
          }}
        />
      )}
      </Suspense>

    </div>
  );
}
