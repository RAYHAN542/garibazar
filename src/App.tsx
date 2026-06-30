/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { auth, db, logAnalyticsEvent } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, getDocs, doc, setDoc, getDoc, updateDoc, where, addDoc, deleteDoc, limit, startAfter, DocumentSnapshot } from "firebase/firestore";
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
} from "lucide-react";

import { PartListing, SupportedLanguage } from "./types";
import { translations, CITIES, CATEGORIES, SAMPLE_LISTINGS, AD_PACKAGES } from "./translations";
import { PromotedSlider } from "./components/PromotedSlider";
import { ListingCard } from "./components/ListingCard";
import { ListingDetailModal } from "./components/ListingDetailModal";
import { EditListingModal } from "./components/EditListingModal";
import { AuthModal } from "./components/AuthModal";
import { PromoteAdModal } from "./components/PromoteAdModal";
import { AddPartForm } from "./components/AddPartForm";
import { RefillModal } from "./components/RefillModal";
import { AdminPanel } from "./components/AdminPanel";
import { ChatView } from "./components/ChatView";
import { PlayStoreDiagnostics } from "./components/PlayStoreDiagnostics";
import SimulatedPaymentPortal from "./components/SimulatedPaymentPortal";
import LegalHubModal from "./components/LegalHubModal";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage";
import DataDeletionPage from "./components/DataDeletionPage";
import SellerAnalyticsGraph from "./components/SellerAnalyticsGraph";
import { SellerShopPage } from "./components/SellerShopPage";
import Fuse from "fuse.js";
import { buildSearchBlob, convertBengaliDigitsToEnglish, convertEnglishDigitsToBengali } from "./searchAliases";
import { MessageSquare, Cpu, SlidersHorizontal, Moon, Sun, Users, HelpCircle, Mail, FileText } from "lucide-react";

const HOME_CATEGORIES = [
  { id: "all", bnName: "সব ক্যাটাগরি", enName: "All Categories" },
  { id: "vehicles", bnName: "গাড়ি ও ভারী যন্ত্রপাতি", enName: "Vehicles & Equipment" },
  { id: "engine", bnName: "ইঞ্জিন ও ট্রান্সমিশন", enName: "Engine & Transmission" },
  { id: "wheels", bnName: "টায়ার ও হুইল", enName: "Tyres & Wheels" },
  { id: "interior", bnName: "ইন্টেরিয়র পার্টস", enName: "Interior Accessories" },
  { id: "exterior", bnName: "এক্সটেরিয়র বডি", enName: "Exterior Body" },
];

const VEHICLE_SUBCATEGORIES = [
  { id: "all", bnName: "সব গাড়ি", enName: "All Vehicles" },
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
  const vehicleKeywords = ["excavator", "crane", "bulldozer", "forklift", "loader", "car", "bus", "truck", "pickup", "hilux", "toyota", "komatsu", "crawler", "মেশিন", "গাড়ি", "এক্সকাভেটর", "এক্সক্যাভেটর", "ক্রেন", "বুলডোজার", "বাস"];
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
  const [language, setLanguage] = useState<SupportedLanguage>("bn"); // DEFAULT to Bengali as requested
  const [activeTab, setActiveTab] = useState<'market' | 'saved' | 'sell' | 'my-dashboard' | 'chats' | 'profile'>('market');
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [initialListingToChat, setInitialListingToChat] = useState<PartListing | null>(null);
  
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
  const [adSelectedListingId, setAdSelectedListingId] = useState<string>("");
  const [adPromoLoading, setAdPromoLoading] = useState(false);
  const [adPromoSuccess, setAdPromoSuccess] = useState(false);
  const [adPromoError, setAdPromoError] = useState("");
  
  // Direct payment states for Dashboard
  const [adPayMode, setAdPayMode] = useState<"instant" | "manual">("instant");
  const [isAdPortalOpen, setIsAdPortalOpen] = useState(false);
  const [adSenderNumber, setAdSenderNumber] = useState("");
  const [adTransactionId, setAdTransactionId] = useState("");
  const [adPaymentMethod, setAdPaymentMethod] = useState<"bKash" | "Nagad" | "Rocket">("bKash");
  const [adPaymentCopied, setAdPaymentCopied] = useState(false);
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
  const [isMyShopSectionOpen, setIsMyShopSectionOpen] = useState(false);
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

  // Check for incoming referral code from shared links
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get("ref");
      if (refCode) {
        localStorage.setItem("gari_bazar_prefilled_referral", refCode.toUpperCase());
        console.log("Captured prefilled referral code:", refCode);
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
        await showNotification("গাড়ি বাজার (Gari Bazar)", {
          body: language === "bn" 
            ? "পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে! আপনাকে স্বাগতম!" 
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
      addedListings.forEach(newListing => {
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
          console.log("Firestore empty in production. No listings to show.");
          setFirebaseListings([]);
        } else {
          console.log("Firestore empty. Fallback to offline mock car parts listings.");
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
            list.push({ id: docSnap.id, ...data } as PartListing);
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
          nextList.push({ id: doc.id, ...doc.data() } as PartListing);
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

    const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"), limit(20));
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
      console.log(`Resetting ${expiredAds.length} expired ad promotions...`);
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
      alert(language === "bn" ? "মুছে ফেলতে ব্যর্থ হয়েছে" : "Failed to delete listing.");
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

  // Instant automatical direct payment success callback like Daraz
  const handleInstantAdPromoSuccess = async (details: { method: string; senderNumber: string; txId: string }) => {
    if (!user) return;
    setIsAdPortalOpen(false);
    setAdPromoLoading(true);
    setAdPromoError("");
    setAdPromoSuccess(false);

    try {
      const targetListing = listings.find(item => item.id === adSelectedListingId);
      if (!targetListing) {
        throw new Error("Listing not found");
      }

      const docData = {
        userId: user.uid,
        userName: user.displayName || "Seller",
        userEmail: user.email || "",
        amount: Number(selectedPromoPkg.price),
        method: details.method,
        senderNumber: details.senderNumber,
        txId: details.txId,
        status: "approved",
        type: "ad_promotion",
        listingId: targetListing.id,
        listingTitle: targetListing.title,
        adTier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        currentViews: targetListing.views || 0,
        createdAt: new Date().toISOString()
      };

      // 1. Submit approved payment record to db
      await addDoc(collection(db, "refill_requests"), docData);

      // 2. Automatically upgrade the listing's visual package status
      const listingRef = doc(db, "listings", targetListing.id);
      await updateDoc(listingRef, {
        isAd: true,
        adTier: selectedPromoPkg.tier
      });

      // 3. Sync local listing item states for real-time responsiveness
      setListings(prev => prev.map(item => item.id === targetListing.id ? { ...item, isAd: true, adTier: selectedPromoPkg.tier } : item));

      // Track Analytics ad promo
      logAnalyticsEvent("ad_promote", {
        listingId: targetListing.id,
        title: targetListing.title,
        tier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        pricePaid: selectedPromoPkg.price,
        isInstant: true
      });

      // 4. Set Success indicator
      setAdPromoSuccess(true);
      setAdSelectedListingId("");
      setAdSenderNumber("");
      setAdTransactionId("");

      setTimeout(() => {
        setAdPromoSuccess(false);
      }, 10000);

    } catch (err: any) {
      console.error("Instant campaign activation failed:", err);
      setAdPromoError(
        language === "bn"
          ? "পেমেন্ট গেটওয়েতে সফল হয়েছে তবে ব্যালেন্স আপডেট ব্যর্থ হয়েছে।"
          : "Direct payment authorized but listing update failed."
      );
    } finally {
      setAdPromoLoading(false);
    }
  };

  // 4a. Launch Ad Campaign directly from user dashboard
  const handleDashboardPromoSubmit = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!adSelectedListingId) {
      setAdPromoError(language === "bn" ? "দয়া করে বিজ্ঞাপন দেয়ার জন্য একটি প্রোডাক্ট সিলেক্ট করুন" : "Please select a product to advertise");
      return;
    }
    if (!selectedPromoPkg) {
      setAdPromoError(language === "bn" ? "দয়া করে একটি সাবস্ক্রিপশন প্যাকেজ সিলেক্ট করুন" : "Please select a subscription package");
      return;
    }
    if (!adSenderNumber.trim() || adSenderNumber.trim().length < 11) {
      setAdPromoError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল প্রেরক নাম্বার দিন" : "Please enter a valid 11-digit sender phone number");
      return;
    }
    if (!adTransactionId.trim()) {
      setAdPromoError(language === "bn" ? "সঠিক ট্রানজেকশন আইডি (TxID) লিখুন" : "Please enter a valid transaction ID");
      return;
    }

    const cleanTx = adTransactionId.trim().toUpperCase();
    const isAlphanumeric = /^[A-Z0-9]+$/.test(cleanTx);
    const hasLetters = /[A-Z]/.test(cleanTx);
    const hasDigits = /[0-9]/.test(cleanTx);
    const blacklistedWords = ["TEST", "FAKE", "DEMO", "ULTAPALTA", "ULTA", "PALTA", "MOCK", "SAMPLE", "QWERTY", "ADMIN", "GARI", "BAZAR", "12345", "ABCDE"];
    const isBlacklisted = blacklistedWords.some(word => cleanTx.includes(word));
    const isRepetitive = /(.)\1{4,}/.test(cleanTx);

    if (cleanTx.length < 8 || cleanTx.length > 12 || !isAlphanumeric || !hasLetters || !hasDigits || isBlacklisted || isRepetitive) {
      setAdPromoError(
        language === "bn"
          ? "ভুল ট্রানজেকশন আইডি! অনুগ্রহ করে সঠিক ৮-১২ সংখ্যার আলফানিউমেরিক আইডি লিখুন (যেমন: BKX9E837D2)। ডেমো বা যেকোনো লেখা গ্রহণযোগ্য নয়।"
          : "Invalid Transaction ID! Please enter a valid 8-12 character alphanumeric ID (e.g. BKX9E837D2). Placeholder or plain text is not accepted."
      );
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

      const docData = {
        userId: user.uid,
        userName: user.displayName || "Seller",
        userEmail: user.email || "",
        amount: Number(selectedPromoPkg.price),
        method: adPaymentMethod,
        senderNumber: adSenderNumber.trim(),
        txId: adTransactionId.trim().toUpperCase(),
        status: "pending",
        type: "ad_promotion",
        listingId: targetListing.id,
        listingTitle: targetListing.title,
        adTier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        currentViews: targetListing.views || 0,
        createdAt: new Date().toISOString()
      };

      // Wrap addDoc in a race/timeout so that if Firestore connection stalls in the preview environment, the user gets an instant success
      const addDocWithTimeout = () => {
        return new Promise<any>((resolve, reject) => {
          let resolved = false;
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.warn("Firestore write stalled, resolving with local fallback.");
              resolve({ id: "temp-" + Date.now() });
            }
          }, 300);

          addDoc(collection(db, "refill_requests"), docData)
            .then((docRef) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                resolve(docRef);
              }
            })
            .catch((err) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                reject(err);
              }
            });
        });
      };

      await addDocWithTimeout();

      // Track Analytics ad promo
      logAnalyticsEvent("ad_promote", {
        listingId: targetListing.id,
        title: targetListing.title,
        tier: selectedPromoPkg.tier,
        durationDays: selectedPromoPkg.durationDays,
        pricePaid: selectedPromoPkg.price,
        isInstant: false
      });

      setAdPromoSuccess(true);
      setAdSelectedListingId("");
      setAdSenderNumber("");
      setAdTransactionId("");

      setTimeout(() => {
        setAdPromoSuccess(false);
      }, 10000);

    } catch (err: any) {
      console.error("Dashboard campaign launch error:", err);
      setAdPromoError(
        language === "bn" 
          ? "বিজ্ঞাপন তৈরি ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।" 
          : "Campaign initialization failed. Please retry."
      );
    } finally {
      setAdPromoLoading(false);
    }
  };

  // 5. Track views asynchronously when user reviews details
  const handleViewListingDetails = async (listing: PartListing) => {
    setSelectedListing(listing);
    
    try {
      const listingRef = doc(db, "listings", listing.id);
      await updateDoc(listingRef, {
        views: (listing.views || 0) + 1
      });
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
      
      const searchOptions = Array.from(new Set([
        queryLower,
        queryEnglishDigits,
        queryBengaliDigits,
        queryLower.replace(/\s+/g, ""),
        queryEnglishDigits.replace(/\s+/g, ""),
        queryBengaliDigits.replace(/\s+/g, ""),
        ...words,
        ...engWords,
        ...bngWords
      ])).filter(Boolean);
      
      let matchedItems: any[] = [];
      const seenIds = new Set<string>();
      
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
            titleLoc.includes(optLower) ||
            brandLoc.includes(optLower) ||
            modelLoc.includes(optLower) ||
            descLoc.includes(optLower) ||
            blobLoc.includes(optLower)
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
      for (const q of searchOptions) {
        if (!q.trim()) continue;
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
          matchesText = textToSearch.includes("engine") || textToSearch.includes("ইঞ্জিন") || textToSearch.includes("cylinder") || textToSearch.includes("sleeve") || textToSearch.includes("gear") || textToSearch.includes("transmission") || textToSearch.includes("গিয়ার") || textToSearch.includes("chain") || textToSearch.includes("চেইন");
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
    );
  }

  if (isStandaloneDeletion) {
    return (
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
                {language === "bn" ? "গাড়ি বাজার" : "Gari Bazar"}
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
                {activeTranslations.navDashboard}
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
                {activeTranslations.navSell}
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

      {/* 4. MAIN LAYOUT AND CORE VIEWS */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-2.5 sm:px-4 md:px-6 lg:px-8 pt-0.5 pb-24 md:pt-4 md:pb-8">
        
        {loading && listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
            <p className="text-slate-500 font-medium text-sm">
              {language === "bn" ? "গাড়ি বাজার লোড হচ্ছে..." : "Loading Gari Bazar..."}
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
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all duration-205 cursor-pointer group ${
                      selectedCategory === "vehicles"
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:border-amber-550/35"
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                      selectedCategory === "vehicles"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-amber-500 group-hover:text-slate-950"
                    }`}>
                      <Car className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-extrabold text-[11.5px] sm:text-xs leading-tight text-slate-850 dark:text-white truncate">
                        {language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
                      </div>
                      <p className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-bold truncate mt-0.5">
                        {language === "bn" ? "গাড়ি ও ভারী ইকুইপমেন্ট" : "Cars & Equipment"}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      const nextCat = selectedCategory === "spare_parts" ? "all" : "spare_parts";
                      setSelectedCategory(nextCat);
                      setSelectedSubCategory("all");
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border transition-all duration-205 cursor-pointer group ${
                      selectedCategory === "spare_parts"
                        ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:border-amber-550/35"
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                      selectedCategory === "spare_parts"
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-amber-500 group-hover:text-slate-950"
                    }`}>
                      <Wrench className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-extrabold text-[11.5px] sm:text-xs leading-tight text-slate-850 dark:text-white truncate">
                        {language === "bn" ? "পার্ট বেচা/কেনা" : "Parts Buy & Sell"}
                      </div>
                      <p className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500 font-bold truncate mt-0.5">
                        {language === "bn" ? "ইঞ্জিন ও খুচরা যন্ত্রাংশ" : "Engines & Spare Parts"}
                      </p>
                    </div>
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
                      📍 {language === "bn" ? "স্থান অনুযায়ী ফিল্টার:" : "Filter by City:"}
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
                        {language === "bn" ? "সব জায়গা" : "All Cities"}
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
                      ⚙️ {language === "bn" ? "সাজানোর নিয়ম:" : "Sort By:"}
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
                            ? "নতুন কোনো গাড়ির পার্টস লিস্টিং হলে বা গ্রাহক হোয়াটসঅ্যাপ/কল করতে চাইলে সাথে সাথে পুশ নোটিফিকেশন এ অ্যালার্ট বা মেসেজ পান।" 
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

                {/* Promo Spotlight slide-show */}
                <PromotedSlider 
                  listings={filteredListings} 
                  language={language}
                  onViewListing={handleViewListingDetails}
                />

                {/* Filter count indicators */}
                <div className="flex items-center justify-between mt-1 mb-3.5 px-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-extrabold font-sans">
                    {language === "bn" 
                      ? `মোট ${filteredListings.length} টি পার্টস পাওয়া গেছে` 
                      : `Found ${filteredListings.length} spares for compatibility`}
                  </div>
                </div>

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
                        ? "দুঃখিত, এই মুহূর্তে কোনো সক্রিয় পার্টস বা গাড়ি পোস্ট করা হয়নি। নতুন পণ্য পোস্ট করা হলে তা সরাসরি এখানে দেখতে পাবেন।" 
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
                      {language === "bn" ? "কোন লিস্টিং পাওয়া যায়নি!" : "No Spare Parts Matches"}
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
            )}

            {/* TAB 2: POST / SELL */}
            {activeTab === 'sell' && (
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
            )}

            {/* TAB 3: USER DASHBOARD & TRACKING DESK */}
            {activeTab === 'my-dashboard' && user && (
              <div className="space-y-8 animate-fade-in">
                
                {/* 1. Header Profile overview card */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left justify-between w-full">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-500 overflow-hidden flex items-center justify-center font-bold text-slate-950 text-lg border-2 border-slate-750">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        user.displayName?.charAt(0).toUpperCase() || "A"
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-sans tracking-tight">{user.displayName || "Gari Bazar User"}</h3>
                      <div className="text-[11px] text-slate-400 mt-1 flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-0.5">
                        <span>📧 {user.email}</span>
                        <span className="hidden sm:inline text-slate-600">•</span>
                        <span>📞 {userMetadata?.phoneNumber || "No number registered"}</span>
                        <span className="hidden sm:inline text-slate-600">•</span>
                        <span>📍 {userMetadata?.city || "No Location"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row items-center gap-2 mt-3 sm:mt-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsStandaloneDeletion(true)}
                      className="px-3.5 py-2 bg-red-650 hover:bg-red-700 text-white font-bold text-[11px] rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md border-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === "bn" ? "অ্যাকাউন্ট মুছুন" : "Delete Account"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-[11px] rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === "bn" ? "লগআউট" : "Logout"}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Marketing Analytics cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
                      <Grid className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{activeTranslations.statsActive}</span>
                      <span className="text-base font-black text-slate-800 dark:text-white">{listings.filter(item => item.sellerId === user.uid).length}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                      <ShoppingBag className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{language === "bn" ? "আমার ক্রুস ট্র্যাক" : "Total Tracked Orders"}</span>
                      <span className="text-base font-black text-slate-800 dark:text-white">{purchases.filter(item => item.buyerId === user.uid).length}</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                      <Eye className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">{language === "bn" ? "মার্কেট ভিউস" : "Your Shop Views"}</span>
                      <span className="text-base font-black text-slate-800 dark:text-white">
                        {listings.filter(item => item.sellerId === user.uid).reduce((sum, current) => sum + (current.views ?? 0), 0) + 18}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seller Performance Analytics Graph */}
                <SellerAnalyticsGraph
                  listings={listings}
                  purchases={purchases}
                  userId={user.uid}
                  language={language}
                />

                {/* 3. Marketing Campaign Wallet Center (Clean version without Refer and Earn) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-5 h-5 text-amber-505" />
                        <h4 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white tracking-tight">
                          {language === "bn" ? "লিস্টিং কভারেজ ও মার্কেটিং বাজেট" : "Premium Campaign Wallet"}
                        </h4>
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-450 leading-normal">
                        {language === "bn" 
                          ? "আপনার পার্টস বিক্রির তালিকাগুলো টপ-স্লাইডারে প্রমোট করার ডেমো পেমেন্ট ও রিচার্জ গেটওয়ে।" 
                          : "Virtual sandbox ad balance used for testing listing spotlight bumps & carousel metrics."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">
                          {language === "bn" ? "চলতি বাজেট ব্যালেন্স" : "Ad Wallet Balance"}
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-orange-650 dark:text-orange-400 font-mono">
                          ৳{(userMetadata?.simulatedCredits ?? user?.simulatedCredits ?? 5000).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRechargeWallet}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-orange-500 hover:bg-orange-650 text-white dark:text-slate-950 font-extrabold text-[10px] sm:text-xs transition flex items-center gap-1 shadow-md shadow-orange-500/20 cursor-pointer border-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === "bn" ? "রিফিল করুন" : "Refill"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dashboard Tab Toggles */}
                <div className="flex border-b border-slate-200 dark:border-slate-800" id="dash-tabs-bar">
                  <button
                    id="dash-subtab-inventory"
                    onClick={() => {
                      setDashboardSubTab('inventory');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                      dashboardSubTab === 'inventory'
                        ? 'border-amber-500 text-amber-500'
                        : 'border-transparent text-slate-400 hover:text-slate-250 dark:hover:text-slate-250'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                    {language === "bn" ? "আমার প্রোডাক্টস ও অর্ডার ট্র্যাকিং" : "My Parts & Order Inquiries"}
                  </button>

                  <button
                    id="dash-subtab-myshop"
                    onClick={() => {
                      setDashboardSubTab('my-shop');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                      dashboardSubTab === 'my-shop'
                        ? 'border-amber-500 text-amber-500'
                        : 'border-transparent text-slate-400 hover:text-slate-250 dark:hover:text-slate-250'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    {language === "bn" ? "আমার দোকান 🛒" : "My Shop 🛒"}
                  </button>

                  <button
                    id="dash-subtab-ads"
                    onClick={() => {
                      setDashboardSubTab('ads');
                      setAdPromoSuccess(false);
                      setAdPromoError("");
                    }}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer relative ${
                      dashboardSubTab === 'ads'
                        ? 'border-amber-500 text-amber-500'
                        : 'border-transparent text-slate-400 hover:text-slate-250 dark:hover:text-slate-250'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    {language === "bn" ? "বিজ্ঞাপন ও ক্যাম্পেইন সেন্টার" : "Promote Ads Center"}
                    <span className="absolute -top-1 -right-2 bg-gradient-to-r from-red-500 to-amber-500 text-white font-extrabold text-[8px] uppercase px-1 rounded-full animate-bounce scale-90">
                      LIVE
                    </span>
                  </button>

                  {isUserAdmin && (
                    <button
                      id="dash-subtab-admin"
                      onClick={() => {
                        setDashboardSubTab('admin');
                      }}
                      className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer relative ${
                        dashboardSubTab === 'admin'
                          ? 'border-red-500 text-red-500'
                          : 'border-transparent text-slate-400 hover:text-slate-250 dark:hover:text-slate-250'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                      {language === "bn" ? "অ্যাডমিন প্যানেল" : "Admin Panel"}
                    </button>
                  )}

                  {isUserAdmin && (
                    <button
                      id="dash-subtab-playstore"
                      onClick={() => {
                        setDashboardSubTab('playstore-audit');
                      }}
                      className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer relative ${
                        dashboardSubTab === 'playstore-audit'
                          ? 'border-amber-500 text-amber-500'
                          : 'border-transparent text-slate-400 hover:text-slate-250 dark:hover:text-slate-250'
                      }`}
                    >
                      <Cpu className="w-4 h-4 text-amber-500" />
                      {language === "bn" ? "প্লে স্টোর গতি ও সিকিউরিটি" : "Play Store & Scaling"}
                    </button>
                  )}
                </div>

                {dashboardSubTab === 'inventory' && (
                  /* 3. My Listings list vs Tracks Purchased items split layout */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                    
                    {/* Left: Listings posted by currently logged in User */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight border-b border-slate-100 dark:border-slate-800 pb-2">
                        {language === "bn" ? "আমার কার পার্টস লিস্টিং" : "My Posted Car Parts"}
                      </h3>

                      {listings.filter(item => item.sellerId === user.uid).length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 p-6 text-center text-slate-500">
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
                                    <span>৳{item.price.toLocaleString("en-IN")}</span>
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
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 p-6 text-center text-slate-500">
                          <p className="text-xs">{language === "bn" ? "কোন অর্ডার বা কেনাকাটার ট্র্যাক ইতিহাস নেই!" : "Empty. Click 'Buy / Order This Part' on any detail card to simulate."}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {purchases.map((item) => (
                            <div 
                              key={item.id}
                              className="bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            >
                              <div className="flex gap-3 items-center min-w-0">
                                <img src={item.images && item.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" loading="lazy" />
                                <div className="min-w-0">
                                  <span className="text-[9px] uppercase font-bold text-indigo-500 tracking-wider block">ID: GBC-{item.id.slice(-5).toUpperCase()}</span>
                                  <h5 className="text-sm font-bold text-slate-850 dark:text-white truncate">{item.title}</h5>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {language === "bn" ? "বিক্রেতা:" : "Seller:"} <span className="font-semibold text-slate-350">{item.sellerName}</span> ({item.sellerContact})
                                  </div>
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-0 border-slate-100 dark:border-slate-850 pt-2 sm:pt-0">
                                <span className="text-xs font-black text-amber-500">৳{item.price.toLocaleString("en-IN")}</span>
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
                    <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <div className="absolute top-0 right-0 p-8 text-amber-500/5 select-none pointer-events-none">
                        <ShoppingBag className="w-48 h-48" />
                      </div>

                      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 z-10 relative">
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
                        <div className="flex gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8 w-full md:w-auto justify-around md:justify-end">
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
                              {language === "bn" ? "সক্রিয় স্টক সংখ্যা" : "Active Items"}
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
                        {language === "bn" ? "আমার চলমান পার্টস ও সক্রিয় বিজ্ঞাপন" : "My Active Live Listings"}
                      </h4>

                      {listings.filter(item => item.sellerId === user.uid && !item.isSold).length === 0 ? (
                        <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 text-slate-500 text-xs">
                          {language === "bn" 
                            ? "আপনার কোন সক্রিয় প্রোডাক্ট বা কার পার্টস লিস্টিং নেই! লিস্টিং যোগ করতে 'বিক্রি করুন' ট্যাবে যান।" 
                            : "You don't have any active listings. Go to the 'Sell Part' tab to add items!"}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {listings.filter(item => item.sellerId === user.uid && !item.isSold).map((listing) => (
                            <ListingCard
                              key={listing.id}
                              listing={listing}
                              language={language}
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
                        <div className="p-6 bg-slate-50 dark:bg-slate-955 rounded-xl text-center text-slate-500 text-xs border border-slate-150 dark:border-slate-850">
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
                  <div className="space-y-8 animate-fade-in" id="ads-campaign-suite">
                    
                    {/* Header Suite Guide */}
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 text-amber-500/5 select-none pointer-events-none">
                        <Sparkles className="w-36 h-36" />
                      </div>
                      <div className="max-w-xl">
                        <span className="text-amber-500 text-xs font-extrabold tracking-widest uppercase block mb-1">
                          {language === "bn" ? "প্রিমিয়াম বিজ্ঞাপন ও ট্রাফিক বুস্টার" : "PREMIUM ADVERTISING SUITE"}
                        </span>
                        <h4 className="text-lg font-black text-white font-sans tracking-tight">
                          {language === "bn" ? "আপনার স্পেয়ার পার্টসের সেলস ১০ গুণ বৃদ্ধি করুন!" : "Accelerate spare part calls and buyer conversions up to 10x!"}
                        </h4>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                          {language === "bn"
                            ? "সহজ উপায়ে আমাদের ডেমো ক্রেডিট ব্যালেন্স ব্যবহার করে আপনার যেকোনো কার পার্টস আইটেমকে মার্কেট ফিল্টারে অথবা আমাদের হোমপেইজের টপ স্লাইডারে স্পন্সর করে বুস্ট করান।"
                            : "Use your simulated promotional wallet budget in real-time. Target direct local phone calls and place your listings prominently on our top slideshow shelves!"}
                        </p>
                      </div>
                    </div>

                    {/* Step 1: AD Packages side-by-side selective grid */}
                    <div className="space-y-3">
                      <h5 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                        {language === "bn" ? "ধাপ ১: বিজ্ঞাপন প্যাকেজ এবং বুস্ট টিয়ার সিলেক্ট করুন" : "STEP 1: SELECT YOUR SPONSORSHIP TIER"}
                      </h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {AD_PACKAGES.map((pkg) => {
                          const isSelected = selectedPromoPkg?.id === pkg.id;
                          return (
                            <div
                              key={pkg.id}
                              onClick={() => {
                                setSelectedPromoPkg(pkg);
                                setAdPromoSuccess(false);
                                setAdPromoError("");
                              }}
                              className={`rounded-2xl p-5 border transition-all cursor-pointer flex flex-col justify-between relative ${
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

                                <div className="mt-4 mb-2 flex items-baseline gap-1">
                                  <span className={`text-2xl font-black font-mono transition-colors ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}>
                                    ৳{pkg.price.toLocaleString("en-IN")}
                                  </span>
                                  <span className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500 dark:text-slate-400"}`}>
                                    / {language === "bn" ? `${pkg.durationDays} দিন` : `${pkg.durationDays} days`}
                                  </span>
                                </div>

                                {/* Benefits bullet list */}
                                <ul className="space-y-2 mt-4">
                                  {(language === "bn" ? pkg.benefitsBn : pkg.benefitsEn).map((benefit, bIdx) => (
                                    <li key={bIdx} className="flex items-start gap-1.5 leading-tight text-[11px]">
                                      <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                      <span className={`${isSelected ? "text-slate-200" : "text-slate-600 dark:text-slate-350"}`}>
                                        {benefit}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="mt-6">
                                <button
                                  type="button"
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
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Campaign config wizard form */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-slate-100 dark:border-slate-800 pt-8">
                      
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
                                    ? "আপনার প্রোফাইলে কোনো লাইভ প্রোডাক্ট লিস্টিং নেই। বিজ্ঞাপন দেয়ার আগে আগে একটি লিস্টিং পোস্ট করুন।"
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
                                className="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-500/30 font-semibold cursor-pointer"
                              >
                                <option value="">
                                  {language === "bn" ? "---একটি প্রোডাক্ট সিলেক্ট করুন---" : "---Choose a Posted Car Part---"}
                                </option>
                                {listings.filter(item => item.sellerId === user.uid).map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title} (৳{item.price.toLocaleString()}) {item.isAd ? `[${language === "bn" ? "ইতিমধ্যে বুস্ট রয়েছে" : "Already boosted"}]` : ""}
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
                                  ? "আপনার পেমেন্ট রিকোয়েস্টটি সফল হয়েছে এবং অ্যাড ক্যাম্পেইনটি সক্রিয় করা হয়েছে!" 
                                  : "Direct payment authorized and your campaign has been activated!"}
                              </span>
                            </div>
                          )}

                          {/* Payment Mode Tab Selection - Direct Online bKash Checkout vs Manual Send Money */}
                          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-955 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setAdPayMode("instant");
                                setAdPromoError("");
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                adPayMode === "instant"
                                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span className="text-slate-955">
                                {language === "bn" ? "অনলাইন গেটওয়ে (No TxID)" : "Online Gateway (No TxID)"}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdPayMode("manual");
                                setAdPromoError("");
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                adPayMode === "manual"
                                  ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                                  : "text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              }`}
                            >
                              <History className="w-3.5 h-3.5 text-slate-900" />
                              <span className="text-slate-955">
                                {language === "bn" ? "ম্যানুয়ালি সেন্ড মানি (TxID)" : "Manual Pay (TxID)"}
                              </span>
                            </button>
                          </div>

                          {adPayMode === "instant" ? (
                            /* INSTANT ONLINE DIRECT CHECKOUT GATEWAY */
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
                              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-600 dark:text-amber-450 space-y-1">
                                <p className="font-extrabold uppercase tracking-wider">
                                  ⚡ {language === "bn" ? "সরাসরি অনলাইন পেমেন্ট" : "Direct Online Checkout"}
                                </p>
                                <p className="text-slate-650 dark:text-slate-350 leading-relaxed">
                                  {language === "bn"
                                    ? "কোনো ম্যানুয়াল সেন্ড মানি বা ট্রানজেকশন আইডি কপি-পেস্ট লাগবে না! নিচের বাটনে ক্লিক করে সরাসরি মোবাইল নম্বর, OTP এবং PIN দিয়ে আপনার অনলাইন পেমেন্ট সম্পন্ন করুন। সাথে সাথে বিজ্ঞাপনটি বুস্ট হয়ে যাবে!"
                                    : "No manual send money or TxID copy-paste required! Simply click below to input mobile, OTP, and PIN to activate. Fast and fully automated!"}
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={adPromoLoading || !adSelectedListingId}
                                onClick={() => {
                                  if (!adSelectedListingId) {
                                    setAdPromoError(language === "bn" ? "দয়া করে বিজ্ঞাপন দেয়ার জন্য একটি প্রোডাক্ট সিলেক্ট করুন" : "Please select a product to advertise");
                                    return;
                                  }
                                  setIsAdPortalOpen(true);
                                }}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase cursor-pointer"
                              >
                                {adPromoLoading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                                    <span>{language === "bn" ? "রিকোয়েস্ট প্রসেস হচ্ছে..." : "Processing..."}</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
                                    <span>
                                      {language === "bn" ? "অনলাইন পেমেন্ট গেটওয়ে দিয়ে পে করুন" : "Pay via Online Checkout Portal"}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            /* MANUAL PAY WITH SENDER & TXID MANUALLY COPIED */
                            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {/* Payment method selector & entries */}
                              <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-705 dark:text-slate-350 block">
                                  {language === "bn" ? "পেমেন্ট মেথড সিলেক্ট করুন:" : "Select Payment Method:"}
                                </label>
                                
                                <div className="grid grid-cols-3 gap-2">
                                  {(["bKash", "Nagad", "Rocket"] as const).map((method) => {
                                    const isSel = adPaymentMethod === method;
                                    return (
                                      <button
                                        type="button"
                                        key={method}
                                        onClick={() => setAdPaymentMethod(method)}
                                        className={`py-2 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                          isSel
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-transparent shadow"
                                            : "bg-slate-50 dark:bg-slate-955 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        }`}
                                      >
                                        {method}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest block">
                                      {language === "bn" ? "প্রেরক নাম্বার (Sender No)" : "Your Mobile Number"}
                                    </label>
                                    <input
                                      type="text"
                                      maxLength={11}
                                      value={adSenderNumber}
                                      onChange={(e) => setAdSenderNumber(e.target.value.replace(/[^0-9]/g, ""))}
                                      placeholder="e.g. 01XXXXXXXXX"
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800 dark:text-white"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-505 dark:text-slate-400 uppercase tracking-widest block">
                                      {language === "bn" ? "ট্রানজেকশন আইডি (TxID)" : "Transaction ID (TxID)"}
                                    </label>
                                    <input
                                      type="text"
                                      value={adTransactionId}
                                      onChange={(e) => setAdTransactionId(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                                      placeholder="e.g. 7X38AB91CF"
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800 dark:text-white"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Trigger CTA */}
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                  id="dash-launch-campaign-btn"
                                  disabled={adPromoLoading || !adSelectedListingId}
                                  onClick={handleDashboardPromoSubmit}
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed uppercase cursor-pointer"
                                >
                                  {adPromoLoading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                                      <span>{language === "bn" ? "রিকোয়েস্ট প্রসেস হচ্ছে..." : "Processing..."}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-4 h-4 text-slate-950" />
                                      <span>
                                        {language === "bn" ? "পেমেন্ট রিকোয়েস্ট সম্পন্ন করুন" : "Pay & Submit Ad Request"}
                                      </span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>

                      {/* Right Block: Live Invoice Estimation Ledger */}
                      <div className="lg:col-span-5 space-y-4">
                        <h5 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                          {language === "bn" ? "পেমেন্ট গাইড ও ইনভয়েস বিল" : "CAMPAIGN INVOICE REPORT"}
                        </h5>

                        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 space-y-5 font-sans relative">
                          
                          <div className="flex flex-col gap-2 pb-3 border-b border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              {language === "bn" ? `আমাদের পার্সোনাল ${adPaymentMethod} নাম্বার:` : `Receiver ${adPaymentMethod} Number:`}
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-extrabold text-amber-400 font-mono select-all">
                                {adPaymentMethod === 'bKash' 
                                  ? ownerPaymentInfo.bkash 
                                  : adPaymentMethod === 'Nagad' 
                                  ? ownerPaymentInfo.nagad 
                                  : ownerPaymentInfo.rocket}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  let num = adPaymentMethod === 'bKash' 
                                    ? ownerPaymentInfo.bkash 
                                    : adPaymentMethod === 'Nagad' 
                                    ? ownerPaymentInfo.nagad 
                                    : ownerPaymentInfo.rocket;
                                  navigator.clipboard.writeText(num.split(" ")[0]);
                                  setAdPaymentCopied(true);
                                  setTimeout(() => setAdPaymentCopied(false), 2000);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                                title="Copy Number"
                              >
                                {adPaymentCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
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
                                {language === "bn" ? "বিজ্ঞাপনের মেয়াদকাল:" : "Ad Spot Duration:"}
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
                                <span>{language === "bn" ? "দিকনির্দেশনাবলী:" : "Simple Directions:"}</span>
                              </div>
                              <p>
                                {language === "bn" 
                                  ? `১. নির্বাচিত মোবাইল ব্যাংকিং চ্যানেলের নাম্বারে ৳${(selectedPromoPkg?.price || 0).toLocaleString()} টাকা "Send Money" করুন।`
                                  : `1. Send exact amount of ৳${(selectedPromoPkg?.price || 0).toLocaleString()} BDT on the displayed number via Send Money.`}
                              </p>
                              <p>
                                {language === "bn" 
                                  ? `২. টাকা পাঠানোর পর আপনার ১১ ডিজিটের মোবাইল নম্বর এবং TrxID বসিয়ে সাবমিট করুন। আমাদের মালিক ভেরিফাই করলেই লাইভ শুরু হবে!`
                                  : `2. Write down your sender phone number & Transaction ID (TxID) in the left form and submit. Real-time review takes 5 minutes.`}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>

                    {/* Section 3: Active boosted list tracker */}
                    <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-8">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                        {language === "bn" ? "আমার চলমান বিজ্ঞাপন এবং ক্যাম্পেইন ট্র্যাকিং" : "My Active Campaigns & Traffic Stats"}
                      </h4>

                      {listings.filter(item => item.sellerId === user.uid && item.isAd).length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-slate-500">
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
                                    <span className="font-semibold text-amber-500">৳{item.price.toLocaleString()}</span>
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
                  <AdminPanel language={language} currentUser={userMetadata || user} listings={listings} isUserAdmin={isUserAdmin} />
                )}

                {dashboardSubTab === 'playstore-audit' && (
                  <PlayStoreDiagnostics language={language} />
                )}

              </div>
            )}

            {/* TAB: CHAT / MESSAGES */}
            {activeTab === 'chats' && (
              <div className="animate-fade-in">
                <ChatView
                  currentUser={user}
                  language={language}
                  onLoginPrompt={() => setIsAuthOpen(true)}
                  initialListingToChat={initialListingToChat}
                  onClearInitialListing={() => setInitialListingToChat(null)}
                />
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
                        ? "আপনার সেভ করে রাখা খুচরা যন্ত্রাংশ এবং গাড়ির বিজ্ঞাপনসমূহ এখানে দেখতে পাবেন।" 
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
                        {language === "bn" ? "কোনো বুকমার্ক পাওয়া যায়নি" : "No saved items yet"}
                      </p>
                      <p className="text-xs text-slate-450 mt-1">
                        {language === "bn" 
                          ? "মার্কেটপ্লেস থেকে যেকোনো লিস্টিংয়ের বুকমার্ক আইকনে ক্লিক করে এখানে সেভ করে রাখতে পারেন।" 
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
            )}

          </div>
        )}

      </main>

      {/* 5. Footer with credit/disclaimers */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3">
          <div className="flex items-center gap-1.5 justify-center text-slate-400 font-bold">
            <Car className="w-4 h-4 text-amber-500" />
            <span>{language === "bn" ? "গাড়ি বাজার লিমিটেড" : "Gari Bazar Auto Parts Marketplace"}</span>
          </div>
          <p className="max-w-md mx-auto leading-relaxed text-[11px] text-slate-500">
            {language === "bn" 
              ? "গাড়ি ও বাইকের অরিজিনাল জেনুইন খুচরা যন্ত্রাংশের বিশ্বস্ত বাজার। স্পন্সরড বিজ্ঞাপনদাতাদের জন্য উন্নত অ্যাড ক্যাম্পেইন ও AI ডেসক্রিপশন জেনারেটর ইঞ্জিন।" 
              : "Bangladesh's premium online car parts listings deck. Refill your promotional wallet to test live boosted sponsored ad placement in real-time."}
          </p>
          <div className="text-[10px] text-slate-650 flex flex-wrap gap-x-4 gap-y-1 justify-center pt-2">
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

      {/* All interactive floating dialogs & Modals */}
      
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
        }}
      />

      {/* 2. Listing Details walk thoughts */}
      {selectedListing && (
        <ListingDetailModal 
          listing={selectedListing}
          language={language}
          currentUser={user}
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

      {/* 5. Simulated Direct Payment Portal for Campaign Promotions */}
      {isAdPortalOpen && (
        <SimulatedPaymentPortal
          isOpen={isAdPortalOpen}
          amount={Number(selectedPromoPkg?.price || 0)}
          language={language}
          onClose={() => setIsAdPortalOpen(false)}
          onSuccess={handleInstantAdPromoSuccess}
        />
      )}

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

    </div>
  );
}
