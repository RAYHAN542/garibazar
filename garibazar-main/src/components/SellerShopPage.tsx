import React, { useState, useEffect } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { X, MapPin, Phone, MessageSquare, Star, ShoppingBag, Search, Sparkles, Loader2, HeartHandshake } from "lucide-react";
import { collection, query, where, getDocs, doc, getDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ListingCard } from "./ListingCard";

interface SellerShopPageProps {
  sellerId: string;
  fallbackSellerName?: string;
  fallbackSellerPhoto?: string;
  fallbackLocation?: string;
  fallbackContact?: string;
  language: SupportedLanguage;
  currentUser: any;
  onClose: () => void;
  onViewListingDetails: (listing: PartListing) => void;
  onInitiateSellerChat?: (listing: PartListing) => void;
  onLoginPrompt?: () => void;
}

export function SellerShopPage({
  sellerId,
  fallbackSellerName = "Gari Bazar Seller",
  fallbackSellerPhoto = "",
  fallbackLocation = "Dhaka",
  fallbackContact = "",
  language,
  currentUser,
  onClose,
  onViewListingDetails,
  onInitiateSellerChat,
  onLoginPrompt
}: SellerShopPageProps) {
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [sellerListings, setSellerListings] = useState<PartListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  
  // Reviews and ratings
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [submitReviewLoading, setSubmitReviewLoading] = useState(false);
  const [submitReviewSuccess, setSubmitReviewSuccess] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Search inside shop
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Seller Profile from users collection
  useEffect(() => {
    let active = true;
    const fetchSellerData = async () => {
      setProfileLoading(true);
      if (sellerId === "demo-seller") {
        setSellerProfile({
          displayName: language === "bn" ? "আল-আমিন অটো পার্টস (Al-Amin Auto Parts)" : "Al-Amin Auto Parts",
          profilePicture: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=150&auto=format&fit=crop&q=80",
          city: language === "bn" ? "ঢাকা" : "Dhaka",
          phoneNumber: "01711223344"
        });
        setProfileLoading(false);
        return;
      }
      if (!sellerId || sellerId === "unregistered") {
        setProfileLoading(false);
        return;
      }
      try {
        const userRef = doc(db, "users", sellerId);
        const userSnap = await getDoc(userRef);
        if (active && userSnap.exists()) {
          setSellerProfile(userSnap.data());
        }
      } catch (err) {
        console.warn("Failed to fetch seller profile:", err);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    fetchSellerData();
    return () => {
      active = false;
    };
  }, [sellerId, language]);

  // Fetch Seller Listings from listings collection
  useEffect(() => {
    let active = true;
    const fetchSellerListings = async () => {
      setListingsLoading(true);
      if (sellerId === "demo-seller") {
        const mockList: PartListing[] = [
          {
            id: "local-demo-1",
            title: language === "bn" ? "টয়োটা করোল্লা ইঞ্জিন এয়ার ফিল্টার (জেনুইন)" : "Toyota Corolla Engine Air Filter (Genuine)",
            category: "Filters",
            subCategory: "Air Filter",
            price: 1250,
            image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=400&auto=format&fit=crop&q=80",
            location: language === "bn" ? "ঢাকা" : "Dhaka",
            description: language === "bn" ? "টয়োটা করোল্লা মডেলের জন্য শতভাগ আসল জাপানি এয়ার ফিল্টার।" : "100% genuine Japanese air filter for Toyota Corolla models.",
            model: "Toyota Corolla",
            contactNumber: "01711223344",
            sellerId: "demo-seller",
            sellerName: language === "bn" ? "আল-আমিন অটো পার্টস" : "Al-Amin Auto Parts",
            isSold: false,
            isAd: false,
            adTier: "none",
            views: 45,
            clicks: 12,
            createdAt: new Date().toISOString()
          },
          {
            id: "local-demo-2",
            title: language === "bn" ? "ব্রেম্বো হাই পারফরম্যান্স ব্রেক প্যাড (জোড়া)" : "Brembo High Performance Brake Pads (Pair)",
            category: "Brakes & Suspension",
            subCategory: "Brake Pads",
            price: 4800,
            image: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&auto=format&fit=crop&q=80",
            location: language === "bn" ? "চট্টগ্রাম" : "Chittagong",
            description: language === "bn" ? "সেরা ব্রেকিং গ্রিপ এবং দীর্ঘস্থায়ী সুরক্ষার জন্য আসল ব্রেম্বো ব্রেক প্যাড।" : "Original Brembo brake pads for ultimate braking grip and long-lasting safety.",
            model: "All Sedans",
            contactNumber: "01711223344",
            sellerId: "demo-seller",
            sellerName: language === "bn" ? "আল-আমিন অটো পার্টস" : "Al-Amin Auto Parts",
            isSold: false,
            isAd: false,
            adTier: "none",
            views: 120,
            clicks: 22,
            createdAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: "local-demo-3",
            title: language === "bn" ? "হোন্ডা সিভিক এলইডি হেডলাইট অ্যাসেম্বলি" : "Honda Civic LED Headlight Assembly (Pair)",
            category: "Body & Lighting",
            subCategory: "Headlight",
            price: 15000,
            image: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=400&auto=format&fit=crop&q=80",
            location: language === "bn" ? "ঢাকা" : "Dhaka",
            description: language === "bn" ? "হোন্ডা সিভিক রিকন্ডিশন্ড হেডলাইট, একদম চমৎকার কন্ডিশন।" : "Honda Civic reconditioned LED headlamps, superb pristine condition.",
            model: "Honda Civic 2018-2020",
            contactNumber: "01711223344",
            sellerId: "demo-seller",
            sellerName: language === "bn" ? "আল-আমিন অটো পার্টস" : "Al-Amin Auto Parts",
            isSold: false,
            isAd: false,
            adTier: "none",
            views: 89,
            clicks: 19,
            createdAt: new Date(Date.now() - 172800000).toISOString()
          }
        ];
        setSellerListings(mockList);
        setListingsLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "listings"),
          where("sellerId", "==", sellerId)
        );
        const snapshot = await getDocs(q);
        if (active) {
          const list: PartListing[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as PartListing);
          });
          // Sort newest first
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSellerListings(list);
        }
      } catch (err) {
        console.warn("Failed to fetch seller listings:", err);
      } finally {
        if (active) setListingsLoading(false);
      }
    };

    fetchSellerListings();
    return () => {
      active = false;
    };
  }, [sellerId, language]);

  // Fetch Reviews
  useEffect(() => {
    let active = true;
    const fetchReviews = async () => {
      setReviewsLoading(true);
      if (sellerId === "demo-seller") {
        const mockReviews = [
          {
            id: "review-demo-1",
            sellerId: "demo-seller",
            reviewerId: "reviewer-1",
            reviewerName: language === "bn" ? "সাকিব আহমেদ" : "Sakib Ahmed",
            rating: 5,
            comment: language === "bn" ? "খুবই ভালো জেনুইন পার্টস পেয়েছি। বিক্রেতার ব্যবহার চমৎকার এবং দ্রুত ডেলিভারি দিয়েছেন।" : "Excellent genuine parts. The seller was very professional and delivered quickly.",
            createdAt: new Date(Date.now() - 259200000).toISOString()
          },
          {
            id: "review-demo-2",
            sellerId: "demo-seller",
            reviewerId: "reviewer-2",
            reviewerName: language === "bn" ? "ইমরান খান" : "Imran Khan",
            rating: 4,
            comment: language === "bn" ? "ব্রেক প্যাডটি একদম অরিজিনাল। দাম কিছুটা বেশি মনে হয়েছে তবে কোয়ালিটি সেরা।" : "The brake pad is 100% original. Price is slightly high but top quality.",
            createdAt: new Date(Date.now() - 604800000).toISOString()
          }
        ];
        setReviews(mockReviews);
        setReviewsLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "seller_reviews"),
          where("sellerId", "==", sellerId)
        );
        const snapshot = await getDocs(q);
        if (active) {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setReviews(list);
        }
      } catch (err) {
        console.warn("Failed to load seller reviews:", err);
      } finally {
        if (active) setReviewsLoading(false);
      }
    };

    fetchReviews();
    return () => {
      active = false;
    };
  }, [sellerId, language]);

  // Handle Review submission
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onLoginPrompt) onLoginPrompt();
      return;
    }
    if (!newComment.trim()) return;

    setSubmitReviewLoading(true);
    try {
      const reviewDoc = {
        sellerId: sellerId,
        reviewerId: currentUser.uid,
        reviewerName: currentUser.displayName || currentUser.email?.split("@")[0] || "Buyer",
        rating: Number(newRating),
        comment: newComment.trim(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "seller_reviews"), reviewDoc);
      setReviews((prev) => [reviewDoc, ...prev]);
      setNewComment("");
      setNewRating(5);
      setSubmitReviewSuccess(true);
      setShowReviewForm(false);
      setTimeout(() => setSubmitReviewSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setSubmitReviewLoading(false);
    }
  };

  // Compute stats
  const activeListings = sellerListings.filter(item => !item.isSold);
  const totalListingsCount = sellerListings.length;
  
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : null;

  // Search filter
  const filteredListings = activeListings.filter(item => {
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(queryLower) ||
      (item.model && item.model.toLowerCase().includes(queryLower)) ||
      (item.category && item.category.toLowerCase().includes(queryLower)) ||
      (item.description && item.description.toLowerCase().includes(queryLower))
    );
  });

  const sellerName = sellerProfile?.displayName || fallbackSellerName;
  const sellerPhoto = sellerProfile?.profilePicture || sellerProfile?.photoURL || fallbackSellerPhoto || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
  const sellerLocation = sellerProfile?.city || fallbackLocation;
  const sellerContact = sellerProfile?.phoneNumber || fallbackContact;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div 
        id="seller-shop-modal-container"
        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-150 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-fade-in"
      >
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-sm sm:text-base tracking-tight font-sans">
              {language === "bn" ? `${sellerName}-এর দোকান` : `${sellerName}'s Shop`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1">
          {/* Seller Profile Card */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <img 
                src={sellerPhoto} 
                alt={sellerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-500 shadow-md shadow-amber-500/10"
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`;
                }}
              />
              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-850 dark:text-white tracking-tight flex items-center gap-2 justify-center sm:justify-start">
                  {sellerName}
                  {sellerId !== "unregistered" && (
                    <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      {language === "bn" ? "ভেরিফাইড" : "Verified"}
                    </span>
                  )}
                </h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {sellerLocation}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-amber-500 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {avgRating ? `${avgRating} / 5` : (language === "bn" ? "কোন রেটিং নেই" : "No ratings yet")}
                    {reviews.length > 0 && ` (${reviews.length} ${language === "bn" ? "রিভিউ" : "reviews"})`}
                  </span>
                </div>
              </div>
            </div>

            {/* Shop Metrics Dashboard */}
            <div className="flex gap-4 sm:border-l border-slate-200 dark:border-slate-800 sm:pl-6 w-full sm:w-auto justify-around sm:justify-end">
              <div className="text-center sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  {language === "bn" ? "মোট বিজ্ঞাপন" : "Total Listings"}
                </span>
                <span className="text-2xl font-black text-slate-800 dark:text-white">
                  {totalListingsCount}
                </span>
              </div>
              <div className="text-center sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  {language === "bn" ? "সক্রিয় স্টক" : "Active Stock"}
                </span>
                <span className="text-2xl font-black text-amber-500">
                  {activeListings.length}
                </span>
              </div>
            </div>
          </div>

          {/* Contact / Action Toolbar if it is another seller */}
          {currentUser?.uid !== sellerId && sellerContact && (
            <div className="flex flex-wrap gap-3 items-center justify-center sm:justify-start">
              <a
                href={`tel:${sellerContact}`}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
              >
                <Phone className="w-4 h-4" />
                <span>{language === "bn" ? `কল করুন: ${sellerContact}` : `Call Seller: ${sellerContact}`}</span>
              </a>
              {onInitiateSellerChat && activeListings.length > 0 && (
                <button
                  onClick={() => onInitiateSellerChat(activeListings[0])}
                  className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-amber-500" />
                  <span>{language === "bn" ? "মেসেজ পাঠান" : "Chat with Seller"}</span>
                </button>
              )}
            </div>
          )}

          {/* Active Listings Grid & Search */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-850 pb-3">
              <h4 className="text-base font-black text-slate-850 dark:text-white tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                {language === "bn" ? "চলতি স্টক এবং পার্টস" : "Active Car Spares & Parts"}
              </h4>

              {/* Inside Shop Search */}
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder={language === "bn" ? "এই দোকানে খুঁজুন..." : "Search inside shop..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            {listingsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-955 rounded-2xl border border-slate-150 dark:border-slate-850 text-slate-500">
                <p className="text-sm font-semibold">
                  {language === "bn" 
                    ? "কোন সক্রিয় পার্টস বা বিজ্ঞাপন পাওয়া যায়নি!" 
                    : "No active listing found in this shop matching your search."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    language={language}
                    onViewDetails={() => onViewListingDetails(listing)}
                    onPromoteClick={() => {}}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Review and Ratings Desk */}
          <div className="border-t border-slate-100 dark:border-slate-850 pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-black text-slate-850 dark:text-white tracking-tight flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-rose-500" />
                {language === "bn" ? "ক্রেতাদের রিভিউ ও ট্রাস্ট স্কোর" : "Customer Reviews & Feedback"}
              </h4>
              
              {currentUser?.uid !== sellerId && !showReviewForm && (
                <button
                  onClick={() => setShowReviewForm(true)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition cursor-pointer"
                >
                  {language === "bn" ? "রিভিউ লিখুন" : "Write Review"}
                </button>
              )}
            </div>

            {/* Review Input form */}
            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 p-4 rounded-xl space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-555 dark:text-slate-400">
                    {language === "bn" ? "রেটিং সিলেক্ট করুন:" : "Choose Rating:"}
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setNewRating(star)}
                        className="p-1 hover:scale-110 transition cursor-pointer"
                      >
                        <Star 
                          className={`w-6 h-6 ${
                            star <= newRating 
                              ? "fill-amber-400 text-amber-400" 
                              : "text-slate-300 dark:text-slate-750"
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-450 uppercase block">
                    {language === "bn" ? "রিভিউ মন্তব্য লিখুন" : "Review Message"}
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={language === "bn" ? "এই বিক্রেতার সার্ভিস বা পার্টস কন্ডিশন সম্পর্কে কিছু লিখুন..." : "Write details about this seller's response, honesty, or parts quality..."}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {language === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={submitReviewLoading}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1 cursor-pointer shadow-md shadow-amber-500/15"
                  >
                    {submitReviewLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>{language === "bn" ? "দাখিল করুন" : "Submit"}</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {submitReviewSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold text-center">
                {language === "bn" ? "রিভিউ সফলভাবে পোস্ট করা হয়েছে!" : "Thank you! Your review has been recorded successfully."}
              </div>
            )}

            {/* Reviews list */}
            {reviewsLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-955 rounded-xl text-center text-slate-500 text-xs border border-slate-150 dark:border-slate-850">
                {language === "bn" ? "এই বিক্রেতার কোনো রিভিউ নেই।" : "This seller doesn't have any reviews yet."}
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-3.5 bg-slate-50 dark:bg-slate-955 rounded-xl border border-slate-150 dark:border-slate-850 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{rev.reviewerName}</span>
                      <span className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-800"}`} />
                      ))}
                    </div>
                    <p className="text-slate-650 dark:text-slate-400 text-xs italic">"{rev.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
