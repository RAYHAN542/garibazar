import React, { useState, useEffect } from "react";
import { PartListing, SupportedLanguage } from "../types";
import { X, Sparkles, Key, CheckCircle, ShieldAlert, Award, Copy, Check, Smartphone, Send, CreditCard } from "lucide-react";
import { AD_PACKAGES } from "../translations";
import { collection, addDoc, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import SimulatedPaymentPortal from "./SimulatedPaymentPortal";

interface PromoteAdModalProps {
  listing: PartListing;
  language: SupportedLanguage;
  currentUser: any;
  onClose: () => void;
  onPromotionSuccess: () => void;
}

export function PromoteAdModal({ listing, language, currentUser, onClose, onPromotionSuccess }: PromoteAdModalProps) {
  const [selectedPackage, setSelectedPackage] = useState(AD_PACKAGES[0]);
  const [payMode, setPayMode] = useState<"instant" | "manual">("instant");
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  
  // Payment dynamic configuration loaded from Firestore
  const [paymentConfig, setPaymentConfig] = useState({
    bkash: "01783457173 (Personal)",
    nagad: "01783457173 (Personal)",
    rocket: "01783457173 (Personal)"
  });

  // Selected checkout method
  const [paymentMethod, setPaymentMethod] = useState<"bKash" | "Nagad" | "Rocket">("bKash");
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load official payment phone numbers from owner settings database
  useEffect(() => {
    const docRef = doc(db, "settings", "payment_info");
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPaymentConfig({
          bkash: data.bkash || "01783457173 (Personal)",
          nagad: data.nagad || "01783457173 (Personal)",
          rocket: data.rocket || "01783457173 (Personal)"
        });
      }
    }, (err) => {
      console.warn("PromoteAdModal using offline fallback/cached payment settings:", err.message);
    });
    return () => unsub();
  }, []);

  const handleCopyNumber = (numStr: string) => {
    // Strip notes/brackets like (Personal)
    const cleanNum = numStr.split(" ")[0] || numStr;
    navigator.clipboard.writeText(cleanNum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDirectPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentUser) {
      setError(language === "bn" ? "বিজ্ঞাপন জমা দিতে দয়া করে প্রথমে লগইন করুন" : "Please login to submit your ad request");
      return;
    }

    if (!senderNumber.trim()) {
      setError(language === "bn" ? "বিকাশ নম্বরটি প্রদান করুন যা থেকে টাকা পাঠানো হয়েছে" : "Please enter the bKash number money was sent from");
      return;
    }

    if (!transactionId.trim()) {
      setError(language === "bn" ? "সঠিক ট্রানজেকশন আইডি (TxID) লিখুন" : "Please write a valid Transaction ID");
      return;
    }

    setLoading(true);

    try {
      const pkgName = selectedPackage.id === "pkg-basic" 
        ? "Basic Boost" 
        : selectedPackage.id === "pkg-premium" 
        ? "Premium Slider" 
        : "Diamond Top Spot";

      const docData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || "Seller",
        userEmail: currentUser.email || "",
        packageName: pkgName, // package name
        amount: Number(selectedPackage.price), // amount
        myNumber: "01993878271", // my number
        txId: transactionId.trim().toUpperCase(), // transaction ID
        senderNumber: senderNumber.trim(), // sending number
        listingId: listing.id, // post ID
        status: "pending", // status field set to 'pending'
        
        type: "ad_promotion",
        listingTitle: listing.title,
        adTier: selectedPackage.tier,
        durationDays: selectedPackage.durationDays,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "refill_requests"), docData);

      setSuccess(true);
      onPromotionSuccess();
    } catch (err: any) {
      console.error("Payment request submission failed:", err);
      setError(language === "bn" ? "পেমেন্ট ডাটা সাবমিট হতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" : "Could not submit your payment request. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleInstantPaymentSuccess = async (details: { method: string; senderNumber: string; txId: string }) => {
    if (!currentUser) return;
    setIsPortalOpen(false);
    setLoading(true);
    setError("");

    try {
      const docData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || "Seller",
        userEmail: currentUser.email || "",
        amount: Number(selectedPackage.price),
        method: details.method,
        senderNumber: details.senderNumber,
        txId: details.txId,
        status: "approved",
        type: "ad_promotion",
        listingId: listing.id,
        listingTitle: listing.title,
        adTier: selectedPackage.tier,
        durationDays: selectedPackage.durationDays,
        currentViews: listing.views || 0,
        createdAt: new Date().toISOString()
      };

      // 1. Submit the approved request to database
      await addDoc(collection(db, "refill_requests"), docData);

      // 2. Automatically activate the ad in listings
      const listingRef = doc(db, "listings", listing.id);
      await updateDoc(listingRef, {
        isAd: true,
        adTier: selectedPackage.tier
      });

      // 3. Set success & proceed
      setSuccess(true);
      onPromotionSuccess();
    } catch (err: any) {
      console.error("Failed to approve instant promotion payment:", err);
      setError(language === "bn" ? "পেমেন্ট সম্পন্ন হয়েছে কিন্তু বিজ্ঞাপন অ্যাক্টিভেশনে সমস্যা হয়েছে। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।" : "Payment authorized but ad activation failed. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const activeNumber = paymentMethod === "bKash" 
    ? paymentConfig.bkash 
    : paymentMethod === "Nagad" 
    ? paymentConfig.nagad 
    : paymentConfig.rocket;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden">
        
        {/* Banner decorative line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"></div>

        <button
          id="close-promote-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-8 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {language === "bn" ? "পেমেন্ট রিকোয়েস্ট সাবমিট হয়েছে!" : "Payment Submitted!"}
            </h3>
            
            <div className="bg-slate-50 dark:bg-slate-950 border rounded-xl p-4 max-w-sm text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-left space-y-2">
              <p className="font-bold text-center text-slate-800 dark:text-slate-200">
                {language === "bn" ? "বিজ্ঞাপনটির বিবরণ:" : "Ad Details Submitted:"}
              </p>
              <div className="flex justify-between border-b pb-1 border-slate-200/50">
                <span>{language === "bn" ? "প্রোডাক্ট:" : "Product:"}</span>
                <span className="font-extrabold truncate max-w-[180px] text-slate-700 dark:text-slate-300">{listing.title}</span>
              </div>
              <div className="flex justify-between border-b pb-1 border-slate-200/50">
                <span>{language === "bn" ? "প্যাকেজ:" : "Package:"}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {language === "bn" ? selectedPackage.nameBn : selectedPackage.nameEn}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === "bn" ? "মূল্য:" : "Price:"}</span>
                <span className="font-black text-amber-500">৳{selectedPackage.price.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm">
              {language === "bn"
                ? "আমাদের সম্মানিত মালিক আপনার পেমেন্ট ভেরিফাই করে ৫ থেকে ১০ মিনিটের মধ্যে বিজ্ঞাপনটি হোমপেইজে স্লাইডার বা টপ গ্লোয়িং স্পটে লাইভ করে দেবেন।"
                : "The admin will verify your bKash/Nagad/Rocket sending transaction and activate your ad banner within 5-10 minutes."}
            </p>

            <button
              id="got-it-modal-btn"
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
            >
              {language === "bn" ? "ঠিক আছে" : "Got it"}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <span className="text-amber-500 text-[10px] font-black tracking-widest uppercase block mb-1">
                {language === "bn" ? "সহজ বিজ্ঞাপন পদ্ধতি" : "SIMPLIFIED ADS SPOTLIGHTS"}
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-sans tracking-tight">
                {language === "bn" ? "আপনার প্রোডাক্টটি বুস্ট করুন" : `Promote "${listing.title}"`}
              </h3>
              <p className="text-slate-500 dark:text-slate-450 text-xs mt-1 leading-relaxed">
                {language === "bn" 
                  ? "যে প্যাকেজটি নিতে চান সেটি সিলেক্ট করে সরাসরি নিচে দেয়া নাম্বারে পেমেন্ট সম্পন্ন করে ট্রানজেকশন সাবমিট করুন।"
                  : "Select an ad duration package, clear the dynamic invoice via Mobile Payment, and enter the TxID of transaction below."}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-655 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Select package/duration in hours */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "bn" ? "ধাপ ১: বিজ্ঞাপন প্যাকেজ এবং সময় সিলেক্ট করুন" : "STEP 1: CHOOSE BUDGET & HOURS DURATION"}
              </span>

              <div className="space-y-2.5">
                {AD_PACKAGES.map((pkg) => {
                  const isSelected = selectedPackage.id === pkg.id;
                  const hours = pkg.durationDays * 24;
                  return (
                    <div
                      id={`pkg-select-${pkg.id}`}
                      key={pkg.id}
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setError("");
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex justify-between items-center ${
                        isSelected
                          ? "border-amber-400 bg-amber-500/[0.03] shadow-md shadow-amber-500/5 ring-1 ring-amber-400"
                          : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
                      }`}
                    >
                      {pkg.tier === "featured" && (
                        <span className="absolute -top-1.5 right-3 bg-gradient-to-r from-red-500 to-amber-500 text-white text-[8px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full shadow">
                          {language === "bn" ? "সেরা ডিল (ভিআইপি)" : "VIP SPOTLIGHT"}
                        </span>
                      )}

                      <div className="flex gap-2.5 items-center">
                        <div className={`p-1.5 rounded-lg ${isSelected ? "bg-amber-500/20 text-amber-500" : "bg-slate-105 dark:bg-slate-800 text-slate-400"}`}>
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white">
                            {language === "bn" ? pkg.nameBn : pkg.nameEn}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400">
                            {language === "bn" 
                              ? `${pkg.durationDays} দিন (${hours} ঘণ্টা প্রদর্শন)` 
                              : `${pkg.durationDays} Days (${hours} Hours Spotlight visibility)`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-sans shrink-0">
                        <span className="text-sm font-black text-amber-500 font-mono">
                          ৳{pkg.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Pay directly via bKash */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                {language === "bn" ? "ধাপ ২: বিকাশ পেমেন্ট ইন্সট্রাকশন" : "STEP 2: BKASH PAYMENT INSTRUCTIONS"}
              </span>

              {/* Exact user-demanded instructions display container */}
              <div id="payment-instruction-banner" className="p-4 bg-amber-500/10 border-2 border-dashed border-amber-500 rounded-2xl text-center space-y-1">
                <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-amber-400 font-sans leading-relaxed select-all">
                  {selectedPackage.id === "pkg-basic" ? (
                    "বিকাশ নাম্বার 01993878271 -এ ৩০০ টাকা সেন্ড মানি করুন"
                  ) : selectedPackage.id === "pkg-premium" ? (
                    "বিকাশ নাম্বার 01993878271 -এ ৫০০ টাকা সেন্ড মানি করুন"
                  ) : (
                    "বিকাশ নাম্বার 01993878271 -এ ১,০০০ টাকা সেন্ড মানি করুন"
                  )}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {language === "bn" ? "উপরে দেয়া বিকাশ নাম্বারে সেন্ড মানি করুন" : "Send Money to the bKash personal number listed above"}
                </p>
              </div>

              {/* Form Inputs */}
              <form onSubmit={handleDirectPaymentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      {language === "bn" ? "যে বিকাশ নাম্বার থেকে টাকা পাঠিয়েছেন" : "The bKash number sent money FROM"}
                    </label>
                    <input
                      type="text"
                      id="input-sender-number"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="e.g. 017XXXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                      {language === "bn" ? "ট্রানজেকশন আইডি (Transaction ID)" : "Transaction ID"}
                    </label>
                    <input
                      type="text"
                      id="input-transaction-id"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. BKX9E837D2"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {language === "bn" ? "বাতিল" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {loading ? (
                      language === "bn" ? "প্রসেস হচ্ছে..." : "Processing..."
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-slate-950" />
                        <span>{language === "bn" ? "পেমেন্ট রিকোয়েস্ট সাবমিট করুন" : "Submit Request"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
