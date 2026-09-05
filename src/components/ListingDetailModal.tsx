import React, { useState, useEffect } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { X, MapPin, Sparkles, Play, SquarePlay, Flag, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight, Loader2, ShoppingBag, MessageSquare, Share2 } from "lucide-react";
import { doc, getDoc, updateDoc, collection, addDoc, query, increment } from "firebase/firestore";
import { db, auth, logAnalyticsEvent } from "../firebase";
import { supabase } from "../supabase";
import { trackListingClick } from "../utils/counters";
import { getOptimizedImageUrl } from "../utils/cloudinary";
import { apiUrl } from "../utils/apiBase";

// Masks all but the last 4 digits so the full number isn't visible in plain
// text to anonymous visitors or scrapers. The underlying tel: link still
// uses the real number, so calling still works without the digits being
// shown on screen until the viewer explicitly taps to reveal them.
const maskPhoneNumber = (num?: string): string => {
  if (!num) return "";
  const digits = num.trim();
  if (digits.length <= 4) return digits;
  return "•".repeat(digits.length - 4) + digits.slice(-4);
};

interface ListingDetailModalProps {
  listing: PartListing;
  language: SupportedLanguage;
  currentUser: any;
  onClose: () => void;
  onPurchaseAdded?: () => void;
  onLoginPrompt?: () => void;
  onInitiateSellerChat?: (listing: PartListing) => void;
  onViewSellerShop?: (sellerId: string, fallbackName: string, fallbackPhoto?: string, fallbackLocation?: string, fallbackContact?: string) => void;
  isAdmin?: boolean;
}

export function ListingDetailModal({ listing, language, currentUser, onClose, onPurchaseAdded, onLoginPrompt, onInitiateSellerChat, onViewSellerShop, isAdmin = false }: ListingDetailModalProps) {
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // ফোন নম্বর আর listing ডকে থাকে না (প্রাইভেসি ফিক্স) — দরকার হলে
  // listings/{id}/private/contact থেকে আলাদাভাবে fetch করা হয়, শুধু
  // owner/admin হলে বা ইউজার "Show number" চাপলে (সবসময় না, যাতে
  // অকারণে extra read না হয়)।
  const [fetchedContactNumber, setFetchedContactNumber] = useState<string | undefined>(listing.contactNumber);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  
  const modalImages = listing.images && listing.images.length > 0 ? listing.images : [listing.image];

  // Track which images have already finished loading so we can show a spinner only while waiting
  const [loadedImageIndexes, setLoadedImageIndexes] = useState<Set<number>>(new Set());

  // Preload every image in the carousel in the background so arrow navigation is instant instead of waiting for each image to download.
  // Preload order starts from the currently active image, then expands outward to its neighbours first,
  // since those are the images the user is most likely to navigate to next.
  useEffect(() => {
    setLoadedImageIndexes(new Set());
    const order: number[] = [];
    for (let offset = 0; offset < modalImages.length; offset++) {
      const forward = (activeImageIndex + offset) % modalImages.length;
      if (!order.includes(forward)) order.push(forward);
      const backward = (activeImageIndex - offset + modalImages.length) % modalImages.length;
      if (!order.includes(backward)) order.push(backward);
    }
    order.forEach((idx) => {
      const src = modalImages[idx];
      if (!src) return;
      const preloadImg = new Image();
      preloadImg.onload = () => {
        setLoadedImageIndexes((prev) => {
          if (prev.has(idx)) return prev;
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
      };
      preloadImg.src = getOptimizedImageUrl(src, 1000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);
  
  // Favorites bookmark tracking
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    try {
      const favs = localStorage.getItem("gari_bazar_favorites") || "[]";
      const parsed = JSON.parse(favs);
      return Array.isArray(parsed) && parsed.includes(listing.id);
    } catch {
      return false;
    }
  });

  // Toggle states
  const [isSold, setIsSold] = useState(listing.isSold || false);
  const [soldLoading, setSoldLoading] = useState(false);

  // Content Flag/Report states
  const [hasReported, setHasReported] = useState<boolean>(() => {
    if (!currentUser) return false;
    return listing.reportedBy?.includes(currentUser.uid) || false;
  });
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState("spam");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const [isAddingToDashboard, setIsAddingToDashboard] = useState(false);
  const [addToDashboardSuccess, setAddToDashboardSuccess] = useState(false);
  const [addToDashboardError, setAddToDashboardError] = useState<string | null>(null);

  // Share state (shows "Link Copied" feedback when Web Share API isn't available)
  const [shareCopied, setShareCopied] = useState(false);

  const handleShareListing = async () => {
    // এই লিংকটা মানুষ কপি করে বাইরে (WhatsApp, Facebook ইত্যাদি) শেয়ার করে,
    // তাই window.location.origin ব্যবহার করা যাবে না -- Capacitor APK-তে
    // (local bundle মোডে) origin হয় "https://localhost", ওয়েব প্রিভিউ/স্টেজিং
    // ডোমেইনে origin হয় ভিন্ন কিছু। পাবলিক শেয়ার লিংক সবসময় আসল ডোমেইনই
    // হতে হবে, যেখান থেকেই শেয়ার করা হোক না কেন।
    const shareUrl = `https://garibazar.shop/l/${listing.id}`;
    const shareTitle = listing.title;
    const shareText = language === "bn"
      ? `গাড়ি বাজারে দেখুন: ${listing.title}`
      : `Check this out on Gari Bazar: ${listing.title}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      }
    } catch (e) {
      // user cancelled share sheet or it failed silently — fall through to clipboard copy
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) {
      console.error("Could not copy share link:", e);
    }
  };

  // Seller Trust/Reviews Rating Integration -- removed

  const handleAddToDashboard = async () => {
    if (!currentUser) {
      if (onLoginPrompt) {
        onLoginPrompt();
      }
      return;
    }

    if (!fetchedContactNumber) {
      setAddToDashboardError(
        language === "bn"
          ? "বিক্রেতার নম্বর এখনো লোড হয়নি, একটু পর আবার চেষ্টা করুন।"
          : "Seller's number hasn't loaded yet - please try again in a moment."
      );
      return;
    }

    setAddToDashboardError(null);
    setIsAddingToDashboard(true);

    const newPurchaseDoc = {
      title: listing.title,
      image: (listing.images && listing.images[0]) || "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=500&auto=format&fit=crop&q=80",
      price: Number(listing.price),
      sellerName: listing.sellerName || "Seller",
      sellerContact: fetchedContactNumber,
      buyerId: currentUser.uid,
      status: language === "bn" ? "অর্ডার পেন্ডিং" : "Pending Delivery",
      createdAt: new Date().toISOString(),
      listingId: listing.id,
      sellerId: listing.sellerId || null
    };

    const tempId = "local_" + Date.now();

    // 1. Immediately save to local storage for instant reactive sync
    try {
      const stored = localStorage.getItem("gari_bazar_local_purchases") || "[]";
      let localPurchases = JSON.parse(stored);
      if (!Array.isArray(localPurchases)) localPurchases = [];

      const updatedLocal = [{ id: tempId, ...newPurchaseDoc }, ...localPurchases];
      localStorage.setItem("gari_bazar_local_purchases", JSON.stringify(updatedLocal));

      // Dispatch storage event so App.tsx synced listener gets triggered instantly
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("Local storage purchase save fail:", e);
    }

    // 2. Submit to Firestore - the real source of truth. Firestore is the
    // thing that actually matters here; if it fails, roll back the
    // optimistic local entry and tell the user honestly instead of
    // showing a fake success.
    try {
      const addPromise = addDoc(collection(db, "purchases"), newPurchaseDoc);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 8000)
      );

      await Promise.race([addPromise, timeoutPromise]);

      setAddToDashboardSuccess(true);
      if (onPurchaseAdded) {
        onPurchaseAdded();
      }
      setTimeout(() => {
        setAddToDashboardSuccess(false);
      }, 3500);
    } catch (err) {
      console.error("Failed to save purchase to Firestore:", err);
      // Roll back the optimistic local entry - it never actually saved.
      try {
        const stored = localStorage.getItem("gari_bazar_local_purchases") || "[]";
        let localPurchases = JSON.parse(stored);
        if (Array.isArray(localPurchases)) {
          localPurchases = localPurchases.filter((p: any) => p.id !== tempId);
          localStorage.setItem("gari_bazar_local_purchases", JSON.stringify(localPurchases));
          window.dispatchEvent(new Event("storage"));
        }
      } catch (_) {}
      setAddToDashboardError(
        language === "bn"
          ? "সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন।"
          : "Couldn't save - please try again."
      );
    } finally {
      setIsAddingToDashboard(false);
    }
  };

  // ownership শুধু sellerId দিয়ে চেক করা হয় — phone number দিয়ে চেক করলে
  // দুইজনের contact নম্বর মিলে গেলে বা placeholder নম্বর ব্যবহার হলে ভুলভাবে
  // "owner" ধরে ফেলার (false positive) ঝুঁকি থাকে।
  const isOwner =
    !!currentUser?.uid &&
    (listing.sellerId === currentUser.uid || listing.sellerId === currentUser.authUid);

  // 🔧 FIX: নম্বর আনার একটাই পথ রাখা হলো। আগে Firebase ID token (auth.currentUser)
  // ব্যবহার করা হতো, কিন্তু লগইন এখন Supabase দিয়ে হয় -- তাই Firebase session
  // থাকে না, token পাওয়া যেত না এবং পোস্টে ক্লিক করে "নম্বর দেখুন" চাপলে কিছুই
  // দেখাত না। এখন Supabase session token পাঠানো হয়, না থাকলে পুরনো Firebase
  // token fallback হিসেবে যায়।
  const fetchContactNumber = React.useCallback(async (): Promise<string | null> => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch (_) { /* ignore */ }
    if (!token) {
      try {
        token = await auth.currentUser?.getIdToken();
      } catch (_) { /* ignore */ }
    }
    if (!token) throw new Error("লগইন সেশন পাওয়া যায়নি");

    const resp = await fetch(apiUrl("/api/get-seller-contact"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ listingId: listing.id }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "নম্বর আনা যায়নি");
    return (data.contactNumber as string) || null;
  }, [listing.id]);

  // owner/admin হলে নম্বর সাথে সাথেই fetch করা হয় (তাদের যেভাবেই হোক দেখার
  // অধিকার আছে); সাধারণ দর্শকের জন্য শুধু "Show number" চাপলে fetch হবে।
  useEffect(() => {
    if (fetchedContactNumber) return; // ইতিমধ্যে আছে
    if (!currentUser?.uid) return;
    if (!isOwner && !isAdmin) return;
    let active = true;
    setContactLoading(true);
    (async () => {
      try {
        const num = await fetchContactNumber();
        if (active && num) setFetchedContactNumber(num);
      } catch (err) {
        console.error("Failed to fetch contact number:", err);
      } finally {
        if (active) setContactLoading(false);
      }
    })();
    return () => { active = false; };
  }, [listing.id, isOwner, isAdmin, currentUser?.uid, fetchedContactNumber, fetchContactNumber]);

  // "Show number" চাপার পর fetch — লগইন করা থাকলেই কাজ করবে।
  useEffect(() => {
    if (!showPhoneNumber || fetchedContactNumber) return;
    if (!currentUser?.uid) {
      setShowPhoneNumber(false);
      onLoginPrompt?.();
      return;
    }
    let active = true;
    setContactLoading(true);
    setContactError(null);
    (async () => {
      try {
        const num = await fetchContactNumber();
        if (active && num) setFetchedContactNumber(num);
        else if (active) setContactError(language === "bn" ? "নম্বর পাওয়া যায়নি।" : "Number not found.");
      } catch (err: any) {
        console.error("Failed to fetch contact number:", err);
        if (active) setContactError(err?.message || (language === "bn" ? "নম্বর আনা যায়নি।" : "Couldn't load the number."));
      } finally {
        if (active) setContactLoading(false);
      }
    })();
    return () => { active = false; };
  }, [showPhoneNumber, listing.id, currentUser?.uid, fetchedContactNumber, onLoginPrompt, fetchContactNumber, language]);


  const toggleFavorite = () => {
    try {
      const favsStr = localStorage.getItem("gari_bazar_favorites") || "[]";
      let favs = JSON.parse(favsStr);
      if (!Array.isArray(favs)) favs = [];
      
      let nextFav;
      if (favs.includes(listing.id)) {
        nextFav = favs.filter((id: string) => id !== listing.id);
        setIsFavorite(false);
      } else {
        nextFav = [...favs, listing.id];
        setIsFavorite(true);
      }
      localStorage.setItem("gari_bazar_favorites", JSON.stringify(nextFav));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.error("Error toggling favorite", e);
    }
  };

  const handleToggleSold = async () => {
    if (!isOwner) return;
    setSoldLoading(true);
    try {
      const newSoldStatus = !isSold;
      const docRef = doc(db, "listings", listing.id);
      await updateDoc(docRef, {
        isSold: newSoldStatus
      });
      setIsSold(newSoldStatus);
      
      // Sync offline listings cache
      const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
      try {
        const localListings = JSON.parse(localListingsStr);
        if (Array.isArray(localListings)) {
          const updated = localListings.map((item: any) => 
            item.id === listing.id ? { ...item, isSold: newSoldStatus } : item
          );
          localStorage.setItem("gari_bazar_local_listings", JSON.stringify(updated));
        }
      } catch {}
      
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Could not update sold status:", err);
    } finally {
      setSoldLoading(false);
    }
  };

  const handleReportListing = async () => {
    if (!currentUser) {
      onLoginPrompt?.();
      return;
    }
    if (hasReported) return;
    setReportLoading(true);
    try {
      const docRef = doc(db, "listings", listing.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentReportedBy = data.reportedBy || [];
        
        if (!currentReportedBy.includes(currentUser.uid)) {
          const nextReportedBy = [...currentReportedBy, currentUser.uid];
          const nextReportCount = (data.reportCount || 0) + 1;
          
          await updateDoc(docRef, {
            reportCount: nextReportCount,
            reportedBy: nextReportedBy
          });
          
          setHasReported(true);
          setReportSuccess(true);
          
          // Instantly hide the flagged document locally
          const hiddenStr = localStorage.getItem("gari_bazar_hidden_listings") || "[]";
          try {
            const hidden = JSON.parse(hiddenStr);
            if (Array.isArray(hidden) && !hidden.includes(listing.id)) {
              localStorage.setItem("gari_bazar_hidden_listings", JSON.stringify([...hidden, listing.id]));
            }
          } catch {}
          
          window.dispatchEvent(new Event("storage"));
        }
      }
    } catch (err) {
      console.error("Report listing incident failure: ", err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleContactClick = async () => {
    // Log contact seller click event in Analytics
    logAnalyticsEvent("contact_seller_click", {
      listingId: listing.id,
      title: listing.title,
      sellerName: listing.sellerName,
      contactNumber: fetchedContactNumber
    });

    // 🔧 Was: a direct client-side updateDoc() writing `clicks` and
    // `dailyStats.{today}.clicks` straight to the listing document. That's
    // now rejected by firestore.rules (those fields are admin/server-only,
    // see api/track-event.ts's comment) -- this was silently failing every
    // time (caught below, never surfaced), so click counts and the seller's
    // analytics graph have been stuck. trackListingClick() goes through the
    // server, which is the only path that's actually allowed to write these
    // fields now.
    try {
      await trackListingClick(listing.id);
    } catch (err) {
      console.warn("Could not increment click counter:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-start sm:items-center p-0 sm:p-4 z-[60] overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full min-h-screen sm:min-h-fit sm:max-w-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 relative overflow-hidden sm:rounded-2xl sm:my-8">
        
        {/* Colorful status highlight for ads */}
        {listing.isAd && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 py-1.5 px-4 text-xs font-bold text-slate-950 flex items-center gap-1.5 justify-center">
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            {language === "bn" 
              ? "বিজ্ঞাপিত বা প্রিমিয়াম বুস্টেড প্রডাক্ট" 
              : "Promoted Special Spotlight Listing"}
          </div>
        )}

        <button
          id="detail-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 bg-slate-950/40 text-white hover:bg-slate-950/60 p-2 rounded-full cursor-pointer z-10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          {/* Top Image or Video player */}
          <div className="relative w-full h-72 sm:h-96 bg-slate-950 flex items-center justify-center overflow-hidden">
            {isPlayingVideo ? (
              <div className="relative w-full h-full bg-black flex flex-col justify-center items-center">
                {/* Elegant simulated media component */}
                <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-slate-800 flex flex-col justify-center items-center">
                  <div className="text-center p-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-amber-500/15 text-amber-500 rounded-full flex items-center justify-center mb-3 animate-bounce">
                      <SquarePlay className="w-6 h-6" />
                    </div>
                    <span className="text-amber-400 font-mono text-xs uppercase tracking-widest block mb-1">
                      [ {language === "bn" ? "পার্টস রিভিউ ভিডিও চলমান" : "PLAYING CAR PART DEMO"} ]
                    </span>
                    <p className="text-slate-300 text-sm font-semibold italic max-w-sm">
                      {language === "bn" 
                        ? `${listing.title} এর ফিটিং ও কন্ডিশন ভিডিও রিভিউ` 
                        : `Live walkthrough of ${listing.title} performance condition`}
                    </p>
                    
                    {/* Media state visuals */}
                    <div className="mt-6 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                      <span className="text-slate-100 text-[11px] font-mono">0:14 / 2:30</span>
                    </div>
                  </div>
                </div>
                
                {/* Controls overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 p-2.5 rounded-lg border border-slate-800 text-white text-xs">
                  <button 
                    onClick={() => setIsPlayingVideo(false)}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    {language === "bn" ? "ছবি দেখুন" : "Back to Photo"}
                  </button>
                  <span className="font-mono text-xs">HDR 1080p • 60 FPS</span>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={getOptimizedImageUrl(modalImages[activeImageIndex], 1000)}
                  alt={listing.title}
                  className="w-full h-full object-contain transition-all duration-300"
                  referrerPolicy="no-referrer"
                  loading="eager"
                  onLoad={() => {
                    setLoadedImageIndexes((prev) => {
                      if (prev.has(activeImageIndex)) return prev;
                      const next = new Set(prev);
                      next.add(activeImageIndex);
                      return next;
                    });
                  }}
                />
                {!loadedImageIndexes.has(activeImageIndex) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/85 to-transparent pointer-events-none"></div>
                
                {/* Image Navigator Overlay */}
                {modalImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev === 0 ? modalImages.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-slate-900/60 text-white hover:bg-slate-900/80 rounded-full transition cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveImageIndex((prev) => (prev === modalImages.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-900/60 text-white hover:bg-slate-900/80 rounded-full transition cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Miniature Dots Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                      {modalImages.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveImageIndex(idx)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === activeImageIndex ? "w-5 bg-amber-500" : "w-1.5 bg-slate-400 opacity-60"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {listing.hasVideo && (
                  /* Floating Action Button inside photo to play video walkthrough */
                  <button
                    onClick={() => setIsPlayingVideo(true)}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-3 rounded-full font-bold text-xs flex items-center gap-2 transition-all shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    {language === "bn" ? "পার্টস ভিডিও দেখুন" : "Play Parts Video"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Content Details */}
          <div className="p-6 space-y-6">
            
            {/* Sold alert banner */}
            {isSold && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />
                <div>
                  <h4 className="text-xs font-black text-red-500 uppercase tracking-tight">
                    {language === "bn" ? "এই প্রোডাক্টটি বিক্রি হয়ে গেছে" : "This Spare Part is Sold"}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-semibold leading-normal mt-0.5">
                    {language === "bn" ? "বিক্রেতা এই প্রোডাক্টটি বিক্রয় সম্পন্ন হিসেবে চিহ্নিত করেছেন। কোনো নতুন কল করার প্রয়োজন নেই।" : "The seller has marked this post as SOLD. Please do not call this number."}
                  </p>
                </div>
              </div>
            )}

            {/* 1. Dam (Price) */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  {language === "bn" ? "দাম (মূল্য)" : "Price (Dam)"}
                </span>
                <span className={`text-3xl font-black font-mono tracking-tight ${isSold ? 'line-through text-slate-450' : 'text-amber-500'}`}>
                  ৳{listing.price.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-455 font-extrabold px-2.5 py-1 rounded">
                  {language === "bn" ? "ফিক্সড দাম" : "Fixed Price"}
                </span>
              </div>
            </div>

            {/* 2. Part name / Model */}
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-md font-bold uppercase tracking-tight">
                  {(listing as any).partCategory || listing.category}
                </span>
                {(listing.id.startsWith("local-") || listing.id.startsWith("temp-") || listing.id.startsWith("part-") || (listing as any).isDemo === true) && (
                  <span className="bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-tight border border-amber-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    {language === "bn" ? "ডেমো বিজ্ঞাপন" : "Demo Listing"}
                  </span>
                )}
                <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-red-500" />
                  {listing.location}
                </span>
              </div>

              <h3 id="detail-part-title" className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
                {listing.title}
              </h3>

              <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-0.5">
                  {language === "bn" ? "মডেল ও ফিটিং স্পেসিফিকেশন" : "Model & Fitability Spec"}
                </span>
                <p className="text-base font-bold text-slate-800 dark:text-slate-100 font-sans">
                  {listing.model}
                </p>
              </div>

              {/* Spares description details block */}
              <div className="mt-3">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1">
                  {language === "bn" ? "প্রোডাক্টের বিবরণ" : "Parts Detail Description"}
                </span>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans bg-slate-50/55 dark:bg-slate-955/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850">
                  {listing.description || (language === "bn" ? "কোনো টেকনিকাল বিবরণ দেওয়া হয়নি।" : "No technical description provided.")}
                </p>
              </div>

              {/* Seller Trust ratings segment removed */}
            </div>

            {/* 3. Seller number / Seller information */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {isAdmin ? (
                <div 
                  className={`flex items-center gap-3 ${onViewSellerShop ? "cursor-pointer hover:opacity-85 active:scale-98 transition-all group/seller" : ""}`}
                  onClick={() => {
                    if (onViewSellerShop) {
                      onViewSellerShop(
                        listing.sellerId || "unregistered",
                        listing.sellerName,
                        (listing as any).sellerPhoto || "",
                        listing.location || "Dhaka",
                        fetchedContactNumber || ""
                      );
                    }
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-955 font-black text-lg flex items-center justify-center uppercase shadow-md shadow-amber-500/10 group-hover/seller:rotate-6 transition-transform">
                    {listing.sellerName?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      {language === "bn" ? "বিক্রেতার নাম (দোকান দেখুন 🛒)" : "Seller Name (View Shop 🛒)"}
                    </span>
                    <p className="font-extrabold text-slate-850 dark:text-white text-base group-hover/seller:text-amber-500 transition-colors">
                      {listing.sellerName}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-955 font-black text-lg flex items-center justify-center uppercase shadow-md shadow-amber-500/10">
                    {listing.sellerName?.charAt(0)?.toUpperCase() || "S"}
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                      {language === "bn" ? "বিক্রেতা" : "Seller"}
                    </span>
                    <p className="font-extrabold text-slate-850 dark:text-white text-base">
                      {listing.sellerName}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-4 flex-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                  {language === "bn" ? "বিক্রেতার মোবাইল নাম্বার" : "Seller Mobile Number"}
                </span>
                {isSold ? (
                  <span className="font-sans font-bold text-sm text-slate-450 block mt-1">
                    {language === "bn" ? "প্রোডাক্ট বিক্রিত (নাম্বার অবরুদ্ধ)" : "Sold out (Number hidden)"}
                  </span>
                ) : (
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <a 
                      id="detail-contact-tele"
                      href={`tel:${fetchedContactNumber || ""}`} 
                      onClick={handleContactClick}
                      className="font-mono font-black text-xl text-amber-500 hover:text-amber-600 hover:underline block cursor-pointer"
                    >
                      📞 {contactLoading ? "..." : (isOwner || isAdmin || showPhoneNumber) ? (fetchedContactNumber || "—") : maskPhoneNumber(fetchedContactNumber)}
                    </a>
                    {contactError && (
                      <p className="w-full text-xs text-red-500">{contactError}</p>
                    )}
                    {!isOwner && !isAdmin && !showPhoneNumber && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowPhoneNumber(true);
                        }}
                        className="text-xs font-bold text-amber-600 dark:text-amber-450 underline underline-offset-2"
                      >
                        {language === "bn" ? "নাম্বার দেখুন" : "Show number"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (Add to Dashboard, Report) */}
            <div className="pt-2 border-t border-slate-150 dark:border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {!isOwner && (
              <div className="flex-1">
                {addToDashboardSuccess ? (
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 py-3 px-5 rounded-xl font-bold text-xs text-center flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span>
                      {language === "bn" ? "ড্যাশবোর্ডের 'সংরক্ষিত' ট্যাবে যুক্ত হয়েছে!" : "Saved to your Dashboard's 'Saved' tab!"}
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleAddToDashboard}
                      disabled={isAddingToDashboard}
                      className="w-full py-3 px-5 rounded-xl font-bold text-xs transition-all duration-250 flex items-center justify-center gap-2 cursor-pointer shadow-md bg-amber-500 hover:bg-amber-600 text-slate-950 active:scale-95 disabled:opacity-50"
                    >
                      {isAddingToDashboard ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )}
                      <span>
                        {language === "bn" ? "ড্যাশবোর্ডে সংরক্ষণ করুন" : "Save to Dashboard"}
                      </span>
                    </button>
                    {addToDashboardError && (
                      <p className="mt-1.5 text-[11px] font-bold text-red-500 text-center">
                        {addToDashboardError}
                      </p>
                    )}
                  </>
                )}
              </div>
              )}

              {!isOwner && (
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) {
                        if (onLoginPrompt) onLoginPrompt();
                        return;
                      }
                      if (onInitiateSellerChat) {
                        onInitiateSellerChat(listing);
                      }
                    }}
                    className="w-full py-3 px-5 rounded-xl font-bold text-xs transition-all duration-250 flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-100 bg-slate-100/5"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {language === "bn" ? "ইন-অ্যাপ চ্যাট করুন" : "Start In-App Chat"}
                    </span>
                  </button>
                </div>
              )}

              {/* Share Option */}
              <button
                type="button"
                onClick={handleShareListing}
                className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                  shareCopied
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                    : "bg-white border-slate-200 text-slate-505 hover:bg-slate-50 hover:text-amber-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 dark:hover:text-amber-400"
                }`}
              >
                {shareCopied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>
                  {shareCopied
                    ? (language === "bn" ? "লিংক কপি হয়েছে!" : "Link Copied!")
                    : (language === "bn" ? "শেয়ার করুন" : "Share")
                  }
                </span>
              </button>

              {/* Report Option */}
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => setShowReportForm(!showReportForm)}
                  disabled={hasReported}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                    hasReported
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-not-allowed"
                      : "bg-white border-slate-200 text-slate-505 hover:bg-slate-50 hover:text-red-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 dark:hover:text-red-400"
                  }`}
                >
                  <Flag className="w-4 h-4" />
                  <span>
                    {hasReported 
                      ? (language === "bn" ? "অভিযোগ নথিভুক্ত" : "Report Registered") 
                      : (language === "bn" ? "বিজ্ঞাপনে আপত্তি জানান" : "Report Ad")
                    }
                  </span>
                </button>
              )}
            </div>

            {/* Report selection form */}
            {showReportForm && !hasReported && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-md">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "bn" ? "রিপোর্ট বা অভিযোগের ধরণ নির্বাচন করুন:" : "Select report reason:"}
                  </span>
                  <button onClick={() => setShowReportForm(false)} className="text-slate-400 hover:text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold">
                  <button 
                    type="button"
                    onClick={() => setSelectedReason("spam")}
                    className={`p-2 rounded-lg border text-left transition ${selectedReason === "spam" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650"}`}
                  >
                    ⚠️ {language === "bn" ? "ভুয়া বা স্প্যাম পোস্ট" : "Fake Price / Spam"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedReason("abusive")}
                    className={`p-2 rounded-lg border text-left transition ${selectedReason === "abusive" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650"}`}
                  >
                    🚫 {language === "bn" ? "অনুপযুক্ত বা গালিগালাজ" : "Abusive detail"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedReason("wrong_model")}
                    className={`p-2 rounded-lg border text-left transition ${selectedReason === "wrong_model" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650"}`}
                  >
                    🚗 {language === "bn" ? "ভুল মডেল ফিটিং" : "Wrong car compatibility"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedReason("out_of_service")}
                    className={`p-2 rounded-lg border text-left transition ${selectedReason === "out_of_service" ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650"}`}
                  >
                    📞 {language === "bn" ? "মোবাইল বন্ধ / সংযোগহীন" : "Seller unreachable"}
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleReportListing}
                    disabled={reportLoading}
                    className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition"
                  >
                    {reportLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block mx-auto"></span>
                    ) : (
                      language === "bn" ? "অভিযোগ সাবমিট করুন" : "Submit Abuse Claim"
                    )}
                  </button>
                </div>
              </div>
            )}

            {reportSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {language === "bn" 
                    ? "অভিযোগটি সফলভাবে প্রশাসনের কাছে পাঠানো হয়েছে। ধন্যবাদ!" 
                    : "Abuse report registered successfully. Post will be moderated."}
                </span>
              </div>
            )}


          </div>
        </div>

      </div>
    </div>
  );
}
