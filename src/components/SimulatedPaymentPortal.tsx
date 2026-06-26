import React, { useState, useEffect } from "react";
import { X, Shield, Smartphone, ChevronRight, Loader2, CreditCard, ArrowLeft, Heart, Check, Copy } from "lucide-react";

interface SimulatedPaymentPortalProps {
  isOpen: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: (paymentDetails: { method: string; senderNumber: string; txId: string }) => void;
  language: "bn" | "en";
  merchantName?: string;
}

export default function SimulatedPaymentPortal({
  isOpen,
  amount,
  onClose,
  onSuccess,
  language,
  merchantName = "Gari Bazar"
}: SimulatedPaymentPortalProps) {
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [senderNumber, setSenderNumber] = useState("");
  const [txId, setTxId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Default payment receiver details
  const merchantNumbers = {
    bkash: "01786-271500 (Personal)",
    nagad: "01786-271500 (Personal)",
    rocket: "01786-271500-1 (Personal)"
  };

  useEffect(() => {
    if (isOpen) {
      setSenderNumber("");
      setTxId("");
      setErrorMessage("");
      setCopied(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle mobile hardware back button to close portal instead of exiting the app
  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy state so that when user clicks hardware back, it pops this dummy state instead of leaving the app
    window.history.pushState({ modalOpen: "payment" }, "");

    const handlePopState = (e: PopStateEvent) => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If we are closing manually via onClose, pop the dummy state to keep history clean
      if (window.history.state?.modalOpen === "payment") {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyNumber = () => {
    const rawNumber = merchantNumbers[method].split(" ")[0];
    navigator.clipboard.writeText(rawNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanSender = senderNumber.trim();
    const cleanTx = txId.trim();

    if (!cleanSender || cleanSender.length < 11) {
      setErrorMessage(
        language === "bn"
          ? "দয়া করে সচল ১১ ডিজিট মোবাইল নম্বর দিন"
          : "Please enter a valid 11-digit mobile number"
      );
      return;
    }

    if (!cleanTx || cleanTx.length < 6) {
      setErrorMessage(
        language === "bn"
          ? "দয়া করে সঠিক ট্রানজেকশন আইডি (TxID) দিন"
          : "Please enter a valid Transaction ID (minimum 6 characters)"
      );
      return;
    }

    setLoading(true);

    /*
      ===================================================================
      PHASE 2 - REAL PAYMENT GATEWAY INTEGRATION PLACEHOLDERS
      ===================================================================
      Below are the placeholder structures to replace this simulation
      with real production APIs (bKash, Nagad, SSLCommerz).

      1. BKASH INTEGRATION BOILERPLATE (Tokenized API):
      -----------------------------------------------
      async function initiateBkashPayment(amount, invoiceId) {
        try {
          const tokenResponse = await fetch("https://pay.bkash.com/v1.2.0-beta/tokenized/payment/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + ID_TOKEN,
              "X-APP-Key": BKASH_APP_KEY
            },
            body: JSON.stringify({
              mode: "0011",
              payerReference: currentUserPhone,
              callbackURL: window.location.origin + "/api/bkash-callback",
              amount: amount,
              currency: "BDT",
              intent: "sale",
              merchantInvoiceNumber: invoiceId
            })
          });
          const result = await tokenResponse.json();
          if (result.bkashURL) {
            window.location.href = result.bkashURL; // Redirect user to real bKash page
          }
        } catch (err) {
          console.error("bKash Init Failed:", err);
        }
      }

      2. NAGAD INTEGRATION BOILERPLATE:
      ---------------------------------
      async function initiateNagadPayment(amount, orderId) {
        const payload = {
          merchantId: NAGAD_MERCHANT_ID,
          orderId: orderId,
          amount: amount,
          datetime: new Date().toISOString(),
          challenge: generateNagadSignature()
        };
        // POST to Nagad secure terminal URL
        const res = await fetch("https://api.nagad.com.bd/payment-gateway/v1/initiate", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const urlObj = await res.json();
        if (urlObj.paymentUrl) window.location.href = urlObj.paymentUrl;
      }

      3. SSLCOMMERZ INTEGRATION BOILERPLATE:
      -------------------------------------
      async function initiateSslCommerz(amount, tranId) {
        const initData = {
          store_id: SSLCOMMERZ_STORE_ID,
          store_passwd: SSLCOMMERZ_PASSWORD,
          total_amount: amount,
          currency: 'BDT',
          tran_id: tranId,
          success_url: `${window.location.origin}/api/payment-success`,
          fail_url: `${window.location.origin}/api/payment-fail`,
          cancel_url: `${window.location.origin}/api/payment-cancel`,
          cus_name: currentUser.displayName,
          cus_email: currentUser.email,
          cus_phone: currentUser.phoneNumber
        };
        // Redirect client to hosted session URL
      }
    */

    // Simulate database receipt verification delay
    setTimeout(() => {
      setLoading(false);
      onSuccess({
        method,
        senderNumber: cleanSender,
        txId: cleanTx
      });
    }, 1800);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 z-55 transition-all duration-300">
      <div className="bg-white text-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative font-sans flex flex-col justify-between" style={{ minHeight: "580px" }}>
        
        {/* Header Section */}
        <div className="bg-white px-5 py-4 flex justify-between items-center border-b border-slate-100 shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h3 className="text-md sm:text-base font-extrabold text-slate-900 tracking-tight">
              {language === "bn" ? "নিরাপদ ম্যানুয়াল পেমেন্ট" : "Secure Manual Payment"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* PROMINENT DEMO MODE WARNING BANNER */}
        <div className="bg-amber-500 text-slate-950 px-5 py-3 font-black text-xs text-center shrink-0 flex flex-col items-center justify-center gap-1 border-b border-amber-600 shadow-sm animate-pulse">
          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-sm">⚠️</span>
            <span className="tracking-tight uppercase">
              {language === "bn"
                ? "ডেমো মোড — এটা real payment না।"
                : "DEMO MODE — This is a simulated payment."}
            </span>
          </div>
          <span className="text-[11px] font-bold opacity-90">
            {language === "bn"
              ? "কোনো টাকা কাটা হবে না।"
              : "No real money will be charged or deducted."}
          </span>
        </div>

        {/* Outer instructions banner */}
        <div className="bg-slate-50 border-b border-slate-150 py-2.5 px-4 text-slate-600 text-[11px] font-bold text-center shrink-0 flex items-center justify-center gap-1.5">
          <span>🛡️</span>
          <span>
            {language === "bn" 
              ? "ম্যানুয়াল পেমেন্ট ভেরিফিকেশন সিস্টেম (১০০% নিরাপদ ও বিশ্বস্ত)" 
              : "Manual Peer-To-Peer Verify Protocol (100% Secure & Compliant)"}
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Method Selector Tabs */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              {language === "bn" ? "১. পেমেন্ট চ্যানেল নির্বাচন করুন" : "1. Choose Payment Channel"}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setMethod("bkash"); setErrorMessage(""); }}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 ${
                  method === "bkash"
                    ? "border-pink-500 bg-pink-50 text-pink-600 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className="text-[13px] italic">bKash</span>
                <span className="text-[9px] opacity-80 font-normal">{language === "bn" ? "বিকাশ" : "Wallet"}</span>
              </button>

              <button
                type="button"
                onClick={() => { setMethod("nagad"); setErrorMessage(""); }}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 ${
                  method === "nagad"
                    ? "border-orange-500 bg-orange-50 text-orange-600 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className="text-[13px] italic">Nagad</span>
                <span className="text-[9px] opacity-80 font-normal">{language === "bn" ? "নগদ" : "Wallet"}</span>
              </button>

              <button
                type="button"
                onClick={() => { setMethod("rocket"); setErrorMessage(""); }}
                className={`py-2.5 px-3 rounded-2xl border text-xs font-black transition-all flex flex-col items-center justify-center gap-1 ${
                  method === "rocket"
                    ? "border-purple-500 bg-purple-50 text-purple-600 shadow-sm"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className="text-[13px] italic">Rocket</span>
                <span className="text-[9px] opacity-80 font-normal">{language === "bn" ? "রকেট" : "Wallet"}</span>
              </button>
            </div>
          </div>

          {/* Payment Instructions Details Box */}
          <div className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-3 shadow-inner">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              {language === "bn" ? "২. টাকা পাঠানোর নিয়মাবলী" : "2. Sending Instructions"}
            </span>
            
            <div className="space-y-2 text-xs text-slate-700 font-semibold leading-relaxed">
              <p>
                {language === "bn" ? "১. আপনার" : "1. Open your"} <span className="font-extrabold text-slate-900 capitalize">{method}</span> {language === "bn" ? "অ্যাপ অথবা ডায়াল প্যাড থেকে বাটন চাপুন।" : "app or dial pad."}
              </p>
              <p>
                {language === "bn" 
                  ? `২. নিচের নম্বরে "Send Money" (সেন্ড মানি) করুন:`
                  : `2. "Send Money" to the personal account number below:`}
              </p>
              
              {/* Receiver display card with clone feature */}
              <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    {method.toUpperCase()} {language === "bn" ? "সীমিত নম্বর" : "Account Number"}
                  </span>
                  <span className="text-sm font-black font-mono text-slate-900">{merchantNumbers[method]}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (language === "bn" ? "কপি হয়েছে" : "Copied") : (language === "bn" ? "কপি করুন" : "Copy")}</span>
                </button>
              </div>

              <div className="flex justify-between items-center bg-slate-100 rounded-xl px-3 py-2 text-xs">
                <span>{language === "bn" ? "প্রদেয় টাকার পরিমাণ:" : "Expected Amount:"}</span>
                <span className="font-extrabold text-slate-900 text-sm font-mono">৳{amount.toLocaleString("en-IN")}.00</span>
              </div>
            </div>
          </div>

          {/* Form input fields */}
          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              {language === "bn" ? "৩. লেনদেনের বিবরণ দিন" : "3. Transaction Verification Info"}
            </span>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-750 block">
                  {language === "bn" ? "যে নম্বর থেকে টাকা পাঠানো হয়েছে:" : "Sender's Mobile Number:"}
                </label>
                <input
                  type="tel"
                  maxLength={11}
                  required
                  placeholder="01XXXXXXXXX"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-750 block">
                  {language === "bn" ? "ট্রানজেকশন আইডি (TxID):" : "Transaction ID (TxID):"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8N2409XJS"
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-extrabold focus:outline-none focus:border-indigo-500 font-mono text-slate-900 uppercase"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-150 font-bold">
                ⚠️ {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs py-3.5 rounded-xl transition shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === "bn" ? "পেমেন্ট চেক করা হচ্ছে..." : "Submitting Details..."}</span>
                </>
              ) : (
                <span>{language === "bn" ? "সিমুলেট পেমেন্ট (ডেমো) / Simulate Payment (Demo)" : "Simulate Payment (Demo)"}</span>
              )}
            </button>
          </form>

        </div>

        {/* Subtotal exactly customized for Daraz/standard invoice */}
        <div className="bg-slate-50 border-t border-slate-150 p-4 shrink-0 flex items-center justify-between text-[11px] text-slate-500 font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <span>Gari Bazar Billing Center</span>
          </div>
          <div>5-10 Minutes Manual Processing</div>
        </div>

      </div>
    </div>
  );
}
