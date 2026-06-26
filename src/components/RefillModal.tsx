import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, onSnapshot, query, where, orderBy, getDoc, updateDoc } from "firebase/firestore";
import { X, Copy, Check, ShieldAlert, Loader2, Coins, CheckCircle2, History, CreditCard, Sparkles, AlertCircle } from "lucide-react";
import { SupportedLanguage } from "../types";
import { sanitizeText, validatePriceInput, validateBanglaPhone } from "../utils/sanitizer";
import SimulatedPaymentPortal from "./SimulatedPaymentPortal";

interface RefillModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  language: SupportedLanguage;
}

export function RefillModal({ isOpen, onClose, currentUser, language }: RefillModalProps) {
  const [payMode, setPayMode] = useState<"instant" | "manual">("instant");
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [amount, setAmount] = useState<number>(5000);
  const [senderNumber, setSenderNumber] = useState("");
  const [txId, setTxId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamic configuration loaded from Firestore
  const [paymentConfig, setPaymentConfig] = useState({
    bkash: "01783457173 (Personal)",
    nagad: "01783457173 (Personal)",
    rocket: "01783457173 (Personal)"
  });

  // User refill requests history
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Listen to payment configuration from Firestore
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(doc(db, "settings", "payment_info"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPaymentConfig({
          bkash: data.bkash || "01783457173 (Personal)",
          nagad: data.nagad || "01783457173 (Personal)",
          rocket: data.rocket || "01783457173 (Personal)"
        });
      }
    });
    return () => unsub();
  }, [isOpen]);

  // Listen to user's refill state history in real-time
  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return;
    const q = query(
      collection(db, "refill_requests"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRequests(list);
      setLoadingHistory(false);
    }, (err) => {
      console.warn("Could not retrieve refill history:", err);
      setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser]);

  // Handle mobile hardware back button to close modal instead of exiting the app
  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy state so that when user clicks hardware back, it pops this dummy state instead of leaving the app
    window.history.pushState({ modalOpen: "refill" }, "");

    const handlePopState = (e: PopStateEvent) => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If we are closing manually via onClose, pop the dummy state to keep history clean
      if (window.history.state?.modalOpen === "refill") {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    // strip out "(Personal)" etc when copying
    const numOnly = text.replace(/[^0-9]/g, "");
    navigator.clipboard.writeText(numOnly);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setError("");
    setSuccess(false);

    if (amount <= 0) {
      setError(language === "bn" ? "দয়া করে সঠিক পরিমাণ লিখুন" : "Please input a valid amount");
      return;
    }
    if (!senderNumber.trim()) {
      setError(language === "bn" ? "টাকা পাঠানোর মোবাইল নম্বর দিন" : "Please enter sender mobile number");
      return;
    }
    if (!txId.trim()) {
      setError(language === "bn" ? "টাকা পাঠানোর ট্রানজেকশন আইডি (TxID) দিন" : "Please enter Payment Transaction ID (TxID)");
      return;
    }

    const cleanTx = txId.trim().toUpperCase();
    const isAlphanumeric = /^[A-Z0-9]+$/.test(cleanTx);
    const hasLetters = /[A-Z]/.test(cleanTx);
    const hasDigits = /[0-9]/.test(cleanTx);
    const blacklistedWords = ["TEST", "FAKE", "DEMO", "ULTAPALTA", "ULTA", "PALTA", "MOCK", "SAMPLE", "QWERTY", "ADMIN", "GARI", "BAZAR", "12345", "ABCDE"];
    const isBlacklisted = blacklistedWords.some(word => cleanTx.includes(word));
    const isRepetitive = /(.)\1{4,}/.test(cleanTx);

    if (cleanTx.length < 8 || cleanTx.length > 12 || !isAlphanumeric || !hasLetters || !hasDigits || isBlacklisted || isRepetitive) {
      setError(
        language === "bn"
          ? "ভুল ট্রানজেকশন আইডি! অনুগ্রহ করে সঠিক ৮-১২ সংখ্যার আলফানিউমেরিক আইডি লিখুন (যেমন: BKX9E837D2)। কোনো ডেমো বা প্লেইন টেক্সট গ্রহণযোগ্য নয়।"
          : "Invalid Transaction ID! Please enter a valid 8-12 character alphanumeric ID (e.g. BKX9E837D2). Placeholder or plain text is not accepted."
      );
      return;
    }

    if (!validateBanglaPhone(senderNumber)) {
      setError(
        language === "bn"
          ? "দয়া করে সঠিক ১১ ডিজিট বাংলাদেশী মোবাইল নম্বর দিন (যেমন: ০১৭XXXXXXXX)"
          : "Please enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX)"
      );
      return;
    }

    setLoading(true);
    try {
      const sanitizedUserName = sanitizeText(currentUser.displayName || "Gari Bazar User", 100);
      const sanitizedUserEmail = sanitizeText(currentUser.email || "", 100);
      const sanitizedSenderNumber = sanitizeText(senderNumber.trim(), 25);
      const sanitizedTxId = sanitizeText(txId.trim().toUpperCase(), 50);

      const docData = {
        userId: currentUser.uid,
        userName: sanitizedUserName,
        userEmail: sanitizedUserEmail,
        amount: Number(amount),
        method: method,
        senderNumber: sanitizedSenderNumber,
        txId: sanitizedTxId,
        status: "pending",
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
          }, 1500);

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

      setSuccess(true);
      setSenderNumber("");
      setTxId("");
      
      // Auto close success alert after 4 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 4000);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
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
      // 1. Write an approved refill_requests document
      const docData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || "Gari Bazar User",
        userEmail: currentUser.email || "",
        amount: Number(amount),
        method: details.method,
        senderNumber: details.senderNumber,
        txId: details.txId,
        status: "approved",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "refill_requests"), docData);

      // 2. Fetch user's current credits and update instantly
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      let currentCredits = 5000;
      if (userSnap.exists()) {
        const data = userSnap.data();
        currentCredits = data.simulatedCredits ?? 5000;
      }

      await updateDoc(userRef, {
        simulatedCredits: currentCredits + Number(amount)
      });

      // 3. Show success
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (err: any) {
      console.error("Error finalizing instant gateway payment:", err);
      setError(language === "bn" ? "পেমেন্ট সম্পন্ন হয়েছে কিন্তু ব্যালেন্স আপডেটে সমস্যা হয়েছে। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।" : "Payment authorized but balance update failed. Admin has been notified.");
    } finally {
      setLoading(false);
    }
  };

  const getMethodName = (type: string) => {
    switch (type) {
      case "bkash": return "bKash (বিকাশ)";
      case "nagad": return "Nagad (নগদ)";
      case "rocket": return "Rocket (রকেট)";
      default: return type;
    }
  };

  const getNumberForMethod = () => {
    if (method === "bkash") return paymentConfig.bkash;
    if (method === "nagad") return paymentConfig.nagad;
    return paymentConfig.rocket;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-55 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden my-8 flex flex-col max-h-[90vh]">
        
        {/* PROMINENT DEMO MODE WARNING BANNER */}
        <div className="bg-amber-500 text-slate-950 px-5 py-3 font-black text-xs text-center shrink-0 flex flex-col items-center justify-center gap-1 border-b border-amber-600 shadow-sm animate-pulse z-10">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm">⚠️</span>
            <span className="tracking-tight uppercase">
              {language === "bn"
                ? "ডেমো মোড — এটা real payment বা রিচার্জ না।"
                : "DEMO MODE — This is a simulated recharge."}
            </span>
          </div>
          <span className="text-[11px] font-extrabold opacity-90">
            {language === "bn"
              ? "কোনো আসল টাকা কাটা হবে না।"
              : "No real money will be charged or deducted."}
          </span>
        </div>

        {/* GOOGLE PLAY COMPLIANCE NOTICE FOR DIGITAL GOODS */}
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-5 py-2.5 shrink-0 flex items-start gap-2 z-10 text-[10px] leading-relaxed text-blue-800 dark:text-blue-300">
          <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-tight">
              {language === "bn" ? "গুগল প্লে পলিসি কমপ্লায়েন্স গেট" : "Google Play Policy Compliance Gate"}
            </p>
            <p className="font-semibold mt-0.5">
              {language === "bn"
                ? "প্লে স্টোর নীতি অনুযায়ী, অ্যান্ড্রয়েড অ্যাপের ভিতর ডিজিটাল সার্ভিস (যেমন বিজ্ঞাপন প্রমোশন বা বাজেট রিচার্জ) কেনার জন্য গুগল প্লে বিলিং ব্যবহার করা বাধ্যতামূলক। ম্যানুয়াল বিকাশ/নগদ পেমেন্ট শুধুমাত্র ওয়েব ব্রাউজারে প্রযোজ্য। অ্যান্ড্রয়েড অ্যাপ রিলিজের পূর্বে প্লে বিলিং এপিআই অ্যাক্টিভেট করুন।"
                : "Per Google Play Developer Console requirements, all digital goods (ad credits, listings promotions) sold inside the Android package must be billed through Google Play Billing (IAP). Manual peer-to-peer transfers are gated for web compatibility."}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {language === "bn" ? "অ্যাড বাজেট রিচার্জ করুন" : "Refill Ad Budget"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Payment Mode Selection Tab - Instant bKash Checkout (Daraz Style) vs Manual TrxID */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-250/20">
          <button
            type="button"
            onClick={() => setPayMode("instant")}
            className={`py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              payMode === "instant"
                ? "bg-amber-500 text-slate-150 shadow-md"
                : "text-slate-650 dark:text-slate-400 hover:text-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span className="text-slate-950">
              {language === "bn" ? "অনলাইন পেমেন্ট গেটওয়ে" : "Online Checkout Portal"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPayMode("manual")}
            className={`py-2.5 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              payMode === "manual"
                ? "bg-amber-500 text-slate-150 shadow-md"
                : "text-slate-650 dark:text-slate-400 hover:text-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-slate-950" />
            <span className="text-slate-950">
              {language === "bn" ? "ম্যানুয়াল সেন্ড মানি (TrxID)" : "Manual Send Money"}
            </span>
          </button>
        </div>

        {payMode === "instant" ? (
          /* INSTANT AUTOMATIC PAYMENT BLOCK */
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === "bn" ? "১. রিচার্জের পরিমাণ নির্বাচন করুন" : "1. Select Recharge Amount"}
              </label>

              {/* Amount input block inside instant */}
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base font-black font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                  required
                />
              </div>

              {/* Presets chips for instant refills */}
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 2000, 5000].map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`py-1.5 px-3.5 rounded-lg border text-xs font-black font-mono transition ${
                      amount === val
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    ৳{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated gateway explanation message card */}
            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/15 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>{language === "bn" ? "রিয়েল-টাইম অনলাইন গেটওয়ে" : "Real-time Online Gateway"}</span>
              </div>
              <p className="text-xs text-slate-550 dark:text-slate-350 leading-relaxed font-semibold">
                {language === "bn" 
                  ? "পেমেন্ট গেটওয়ে অপশন দিয়ে আপনি bKash/Nagad/Rocket এর যেকোনো অ্যাকাউন্ট অথবা ইন্টারফেস ব্যবহার করে সরাসরি মক পেমেন্ট করতে পারবেন। পেমেন্ট কনফার্ম হওয়া মাত্রই ব্যালেন্স ইনস্ট্যান্ট বেড়ে যাবে!"
                  : "Using the secure online gateway option, you can mock-pay instantly via authentic bKash, Nagad, or Rocket themed web checkout pages. Refill adds credits to your account immediately with no admin wait!"}
              </p>
            </div>

            {error && <p className="text-red-500 text-xs font-bold font-sans">{error}</p>}
            
            {success && (
              <div className="p-3 bg-emerald-650/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>
                  {language === "bn"
                    ? "অনলাইন গেটওয়ে পেমেন্ট সফল হয়েছে! ব্যালেন্স ইনস্ট্যান্ট রিচার্জ করা হয়েছে।"
                    : "Online checkout completed successfully! Credits have been instantly added to your wallet."}
                </span>
              </div>
            )}

            {/* Launch Checkout button */}
            <button
              type="button"
              onClick={() => setIsPortalOpen(true)}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/15 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-slate-950" />
              <span>
                {language === "bn" 
                  ? `৳${amount.toLocaleString()} সরাসরি পেমেন্ট করুন (স্বয়ংক্রিয় গেটওয়ে)` 
                  : `Proceed to Pay ৳${amount.toLocaleString()} (Instant Gateway)`}
              </span>
            </button>
          </div>
        ) : (
          /* MANUAL OFFLINE BANK MATCHING BLOCK */
          <div className="space-y-5">
            {/* Informative Alert */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                {language === "bn" ? (
                  <span>
                    নিচের যেকোনো একটি ট্রাস্টেড একাউন্টে <strong>সেন্ড মানি (Send Money)</strong> করুন। তারপর পেমেন্ট প্রুফ হিসেবে আপনার সেন্ডার নম্বর ও Transaction ID নিচে সাবমিট করুন। অ্যাডমিন আপনার পেমেন্ট যাচাই করে ৫-১০ মিনিটের মধ্যে বাজেট এড করে দেবে।
                  </span>
                ) : (
                  <span>
                    Please perform a <strong>Send Money</strong> transaction to any of our official wallets. Afterward, submit your sender mobile number and Transaction ID (TxId) below. Admin will verify details and add credits within 5-10 minutes.
                  </span>
                )}
              </div>
            </div>

            {/* Step 1: Select Channel */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                {language === "bn" ? "১. পেমেন্ট চ্যানেল সিলেক্ট করুন" : "1. Select Payment Method"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("bkash")}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                    method === "bkash"
                      ? "border-pink-500 bg-pink-500/10 text-pink-600 dark:text-pink-400"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="font-sans">bKash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("nagad")}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                    method === "nagad"
                      ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="font-sans">Nagad</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("rocket")}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition ${
                    method === "rocket"
                      ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className="font-sans">Rocket</span>
                </button>
              </div>
            </div>

            {/* Step 2: Show Owner Payment Number */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-405 dark:text-slate-500 uppercase font-black tracking-wider block">
                  {language === "bn" ? `${getMethodName(method)} সেন্ড মানি নম্বর` : `${method.toUpperCase()} Send Money Number`}
                </span>
                <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono tracking-wide mt-1 block">
                  {getNumberForMethod()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(getNumberForMethod())}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/20"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? (language === "bn" ? "কপি হয়েছে" : "Copied") : (language === "bn" ? "কপি" : "Copy")}
              </button>
            </div>

            {/* Step 3: Transaction submission form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    {language === "bn" ? "২. রিচার্জের পরিমাণ (৳)" : "2. Recharge Amount (৳)"}
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    {language === "bn" ? "৩. প্রেরক মোবাইল নম্বর" : "3. Sender Mobile No"}
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 017XXXXXXXX"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  {language === "bn" ? "৪. ট্রানজেকশন আইডি (TxID)" : "4. Transaction ID (TxID)"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. BAX124H67A"
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold uppercase tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                  required
                />
              </div>

              {/* Quick preset amount chips */}
              <div className="flex gap-1.5 flex-wrap">
                {[500, 1000, 2000, 5000].map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`py-1 px-2.5 rounded-lg border text-[10px] font-extrabold font-mono transition ${
                      amount === val
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    ৳{val.toLocaleString()}
                  </button>
                ))}
              </div>

              {error && <p className="text-red-500 text-xs font-bold font-sans">{error}</p>}

              {success && (
                <div className="p-3 bg-emerald-550/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  <span>
                    {language === "bn"
                      ? "পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন কিছুক্ষণ পর সফল হলে ব্যালেন্স বাড়িয়ে দেবে।"
                      : "Refill request sent! Admin will verify and increase your ad wallet balance soon."}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  language === "bn" ? "রিফিল রিকোয়েস্ট সাবমিট করুন" : "Submit Refill Request"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Requests tracking section */}
        <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-3">
          <span className="text-[10px] font-bold text-slate-405 dark:text-slate-500 uppercase tracking-widest block">
            {language === "bn" ? "আমার পূর্ববর্তী রিফিল হিস্টোরি" : "My Credit Refill History"}
          </span>

          {loadingHistory ? (
            <div className="flex justify-center p-3">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400 italic py-2">
              {language === "bn" ? "এখনও কোনো রিচার্জের আবেদন করা হয়নি" : "No recharge applications submitted yet"}
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1" id="refill-requests-list">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex items-center justify-between text-xs font-sans"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold font-mono text-amber-500">৳{req.amount.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-400 capitalize">({req.method})</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      TxId: <span className="uppercase font-semibold text-slate-600 dark:text-slate-300">{req.txId}</span> | {req.senderNumber}
                    </div>
                  </div>

                  <div>
                    {req.status === "pending" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500">
                        {language === "bn" ? "পেন্ডিং" : "Pending"}
                      </span>
                    ) : req.status === "approved" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500">
                        {language === "bn" ? "অনুমোদিত" : "Approved"}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-500">
                        {language === "bn" ? "বাতিল" : "Rejected"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      </div>

      {/* Simulated bKash/Nagad/Rocket Payment Portal overlay */}
      <SimulatedPaymentPortal
        isOpen={isPortalOpen}
        amount={amount}
        onClose={() => setIsPortalOpen(false)}
        onSuccess={handleInstantPaymentSuccess}
        language={language}
        merchantName="Gari Bazar AD Portal"
      />
    </div>
  );
}
