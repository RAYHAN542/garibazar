import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { CheckCircle2, Loader2, X } from "lucide-react";

const STORAGE_KEY = "gari_bazar_pending_payment";

export function PaymentStatusBanner() {
  const [pending, setPending] = useState<any>(null);
  const [status, setStatus] = useState<"pending" | "approved" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      // Ignore stale entries older than 2 hours
      if (Date.now() - parsed.createdAt > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setPending(parsed);
      setStatus("pending");
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!pending?.requestId) return;
    const ref = doc(db, "refill_requests", pending.requestId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().status === "approved") {
        setStatus("approved");
      }
    });
    return () => unsub();
  }, [pending]);

  const handleClose = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPending(null);
    setStatus(null);
  };

  if (!pending || !status) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] px-3 pt-3">
      <div className={`max-w-lg mx-auto rounded-xl shadow-lg border p-3 flex items-center gap-3 ${
        status === "approved"
          ? "bg-emerald-500 border-emerald-600 text-white"
          : "bg-amber-500 border-amber-600 text-slate-950"
      }`}>
        {status === "approved" ? (
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        ) : (
          <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
        )}
        <div className="flex-1 text-xs font-bold leading-snug">
          {status === "approved"
            ? (pending.type === "ad_promotion"
                ? "পেমেন্ট সফল হয়েছে! আপনার বিজ্ঞাপন বুস্ট হয়ে গেছে।"
                : "পেমেন্ট সফল হয়েছে! ব্যালেন্স যোগ হয়ে গেছে।")
            : "পেমেন্ট যাচাই করা হচ্ছে... সাধারণত কয়েক মিনিট সময় লাগে। টাকা হারায়নি, একটু অপেক্ষা করুন।"}
        </div>
        <button onClick={handleClose} className="flex-shrink-0 opacity-80 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
