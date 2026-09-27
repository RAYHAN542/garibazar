/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { logAnalyticsEvent } from "./firebase";
import { supabase } from "./supabase";
import { logger } from "./utils/logger";
import { trackEvent } from "./utils/trackEvent";
import { withTimeout, TimeoutError } from "./utils/withTimeout";
import { apiUrl } from "./utils/apiBase";
import { incrementListingView } from "./utils/counters";
import { shuffleArray } from "./utils/shuffle";
import {
  fetchInitialListings as fetchInitialListingsFromSupabase,
  fetchMoreListings as fetchMoreListingsFromSupabase,
  fetchAdListings as fetchAdListingsFromSupabase,
  fetchMyListings as fetchMyListingsFromSupabase,
  fetchListingById,
} from "./utils/listingsApi";
import { useAdPromotion } from "./hooks/useAdPromotion";
import { Car, Search, User, LogOut, Globe, Loader2, ShoppingBag, Phone, ChevronRight, ShieldCheck, Send, Check, Download, Smartphone } from "lucide-react";

import { PartListing, SupportedLanguage } from "./types";
import { translations, CATEGORIES, SAMPLE_LISTINGS, AD_PACKAGES } from "./translations";

import { ListingCard } from "./components/ListingCard";
import { HeaderNav } from "./components/HeaderNav";
import MarketplaceTab from "./components/MarketplaceTab";
const ListingDetailModal = lazy(() => import("./components/ListingDetailModal").then(m => ({ default: m.ListingDetailModal })));
const EditListingModal = lazy(() => import("./components/EditListingModal").then(m => ({ default: m.EditListingModal })));
const AuthModal = lazy(() => import("./components/AuthModal").then(m => ({ default: m.AuthModal })));
const PromoteAdModal = lazy(() => import("./components/PromoteAdModal").then(m => ({ default: m.PromoteAdModal })));
const LotteryModal = lazy(() => import("./components/LotteryModal").then(m => ({ default: m.LotteryModal })));
const AddPartForm = lazy(() => import("./components/AddPartForm").then(m => ({ default: m.AddPartForm })));
const AdminPanel = lazy(() => import("./components/AdminPanel").then(m => ({ default: m.AdminPanel })));
const ChatView = lazy(() => import("./components/ChatView").then(m => ({ default: m.ChatView })));
const LegalHubModal = lazy(() => import("./components/LegalHubModal"));
const PrivacyPolicyPage = lazy(() => import("./components/PrivacyPolicyPage"));
const DataDeletionPage = lazy(() => import("./components/DataDeletionPage"));
const AboutContactPage = lazy(() => import("./components/AboutContactPage"));
const SellerAnalyticsGraph = lazy(() => import("./components/SellerAnalyticsGraph"));
const SellerShopPage = lazy(() => import("./components/SellerShopPage").then(m => ({ default: m.SellerShopPage })));
const DashboardTab = lazy(() => import("./components/DashboardTab"));
import Fuse from "fuse.js";
import { buildSearchBlob, convertBengaliDigitsToEnglish, convertEnglishDigitsToBengali, toPhoneticKey } from "./searchAliases";
import { Moon, Sun, Users, HelpCircle, Mail, FileText, Menu } from "lucide-react";
import vehicleCardImg from "./assets/images/vehicle-card-new.webp";
import partsCardImg from "./assets/images/parts-card-new.webp";
import PullToRefresh from "./components/PullToRefresh";
import UpdateBanner from "./components/UpdateBanner";

const HOME_CATEGORIES = [
  { id: "all", bnName: "সব ক্যাটাগরি", enName: "All Categories" },
  { id: "vehicles", bnName: "গাড়ি ও ভারী যন্ত্রপাতি", enName: "Vehicles & Equipment" },
  { id: "engine", bnName: "ইঞ্জিন ও ট্রান্সমিশন", enName: "Engine & Transmission" },
  { id: "wheels", bnName: "টায়ার ও হুইল", enName: "Tyres & Wheels" },
  { id: "interior", bnName: "ইন্টেরিয়র পার্টস", enName: "Interior Accessories" },
  { id: "exterior", bnName: "এক্সটেরিয়র বডি", enName: "Exterior Body" },
];

import { checkIsProduction, isItemVehicle, matchesSubCategoryFilter } from "./utils/listingFilters";

const MAX_INLINE_ADS = 15;
const ADS_INTERLEAVE_GAP = 5;
const MAX_SPOTLIGHT_ADS = 12;

export default function App() {
