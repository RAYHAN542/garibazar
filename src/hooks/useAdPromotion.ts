import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { auth, db, logAnalyticsEvent } from "../firebase";
import { SupportedLanguage } from "../types";
import { apiUrl } from "../utils/apiBase";

interface UseAdPromotionParams {
  user: any;
  language: SupportedLanguage;
  setIsAuthOpen: (open: boolean) => void;
  myListings: any[];
  listings: any[];
  selectedPromoPkg: any;
}

// Dashboard "launch ad campaign" flow: creates a pending refill_request doc,
// asks the server to open a UddoktaPay checkout session for it, then sends
// the user there. On successful payment, the webhook (server-side) activates
// the ad automatically -- this hook's job ends at "redirect to checkout".
export function useAdPromotion({
  user,
  language,
  setIsAuthOpen,
  myListings,
  listings,
  selectedPromoPkg,
}: UseAdPromotionParams) {
  const [adSelectedListingId, setAdSelectedListingId] = useState<string>("");
  const [adPromoLoading, setAdPromoLoading] = useState(false);
  const [adPromoSuccess, setAdPromoSuccess] = useState(false);
  const [adPromoError, setAdPromoError] = useState("");

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
      const targetListing =
        myListings.find(item => item.id === adSelectedListingId) ||
        listings.find(item => item.id === adSelectedListingId);
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
      const res = await fetch(apiUrl("/api/payment/create-charge"), {
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

  return {
    adSelectedListingId,
    setAdSelectedListingId,
    adPromoLoading,
    adPromoSuccess,
    setAdPromoSuccess,
    adPromoError,
    setAdPromoError,
    handleDashboardPromoSubmit,
  };
}
