import React, { useState, useEffect } from "react";
import { Trash2, AlertTriangle, ArrowLeft, Globe, Loader2, CheckCircle, Mail } from "lucide-react";
import { SupportedLanguage } from "../types";
import { auth } from "../firebase";
import { supabase } from "../supabase";
import { apiUrl } from "../utils/apiBase";

interface DataDeletionPageProps {
  language?: SupportedLanguage;
  onBack?: () => void;
  standalone?: boolean;
}

export default function DataDeletionPage({ 
  language: initialLanguage = "bn", 
  onBack, 
  standalone = false 
}: DataDeletionPageProps) {
  const [lang, setLang] = useState<SupportedLanguage>(initialLanguage);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [confirmationInput, setConfirmationInput] = useState("");

  // 🔧 (2026-09-26) আগে এই পেজ শুধু auth.currentUser (legacy Firebase Auth)
  // চেক করত। ফোন-লগইন ইউজাররা এখন Supabase Auth দিয়ে সাইন ইন করে -- তাই
  // তারা আসলে লগইন থাকলেও এই পেজ সবসময় "আগে লগইন করুন" দেখাত, আর
  // properly-built Supabase-based delete_account হ্যান্ডলার কখনোই কল হতো
  // না। এখন dual-auth চেক করা হয় (আগে Supabase, fallback হিসেবে legacy
  // Firebase) -- ঠিক ListingDetailModal.tsx-এর getAuthToken()-এর মতো একই
  // প্যাটার্ন।
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session?.user || auth.currentUser) {
          setIsLoggedIn(true);
        }
      } finally {
        if (active) setCheckingAuth(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const getAuthToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const supaToken = sessionData?.session?.access_token;
    if (supaToken) return supaToken;
    const fbToken = await auth.currentUser?.getIdToken().catch(() => undefined);
    return fbToken || null;
  };

  const handleDataDeletion = async () => {
    if (confirmationInput.toLowerCase() !== "delete") {
      setError(lang === "bn" ? "নিশ্চিত করতে নিচে ফর্মে 'DELETE' লিখুন।" : "Please type 'DELETE' to confirm.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const idToken = await getAuthToken();
      if (!idToken) {
        throw new Error(
          lang === "bn"
            ? "লগইন সেশন পাওয়া যায়নি। আবার লগইন করে চেষ্টা করুন।"
            : "No active login session found. Please sign in again and retry."
        );
      }

      // 🔧 আগে এখানে সরাসরি ক্লায়েন্ট থেকে Firestore deleteDoc/deleteUser কল
      // হতো, যেটা শুধু legacy Firebase ডাটা মুছত, আসল Supabase রেকর্ড না।
      // এখন properly-built, Supabase-based /api/account-actions
      // (action: "delete_account") সার্ভার সাইডে service role দিয়ে
      // listings/public_profiles/users/user_auth_links মুছে এবং Supabase
      // Auth থেকে ইউজারকে ডিলিট করে।
      const resp = await fetch(apiUrl("/api/account-actions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "delete_account" }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || (lang === "bn" ? "অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে।" : "Failed to purge account data."));
      }

      try {
        localStorage.removeItem("gari_bazar_session_user");
      } catch {}
      try {
        await supabase.auth.signOut();
      } catch {}

      setCompleted(true);
    } catch (err: any) {
      console.error("Account & Data deletion failed:", err);
      setError(err.message || (lang === "bn" ? "অ্যাকাউন্ট ডিলিট করতে সমস্যা হয়েছে।" : "Failed to purge account data."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 ${standalone ? "py-8 px-4 sm:px-6 lg:px-8" : "p-0"}`}>
      <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Header Block */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-red-950 text-white px-6 sm:px-8 py-8 shrink-0 relative">
          <div className="absolute right-4 top-4 flex items-center gap-2 bg-slate-850/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/50">
            <Globe className="w-4 h-4 text-amber-400" />
            <button 
              onClick={() => setLang("bn")} 
              className={`text-xs font-bold transition-all px-2 py-0.5 rounded ${lang === "bn" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              বাংলা
            </button>
            <span className="text-slate-600">|</span>
            <button 
              onClick={() => setLang("en")} 
              className={`text-xs font-bold transition-all px-2 py-0.5 rounded ${lang === "en" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              English
            </button>
          </div>

          <div className="space-y-3 mt-4 sm:mt-1">
            {onBack && (
              <button 
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-white transition-colors cursor-pointer bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/30"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {lang === "bn" ? "ফিরে যান" : "Go Back"}
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/15 border border-red-500/25 rounded-2xl text-red-400">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-0.5">
                  {lang === "bn" ? "অ্যাকাউন্ট ও তথ্য অপসারণ" : "Delete Account & Data"}
                </h1>
                <p className="text-xs text-slate-300">
                  {lang === "bn" ? "প্লে স্টোর ডাটা ডিলিট অনুরোধ ফর্ম" : "Play Store Data Deletion Hub"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {completed ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex p-3 rounded-full bg-green-50 text-green-600 border border-green-200">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {lang === "bn" ? "আপনার ডাটা স্থায়ীভাবে মুছে ফেলা হয়েছে!" : "Data Purged Successfully!"}
              </h2>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                {lang === "bn" 
                  ? "গাড়ি বাজার থেকে আপনার অ্যাকাউন্ট, বিজ্ঞাপনসমূহ এবং সমস্ত ব্যক্তিগত তথ্য স্থায়ীভাবে ডাটাবেস থেকে মুছে ফেলা হয়েছে।" 
                  : "All of your listings, profile records, and credential tokens have been permanently cleared from Gari Bazar servers."}
              </p>
              <button 
                onClick={() => window.location.href = "/"}
                className="px-6 py-2.5 bg-slate-950 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition"
              >
                {lang === "bn" ? "হোমে ফিরে যান" : "Go to Homepage"}
              </button>
            </div>
          ) : (
            <>
              <div className="border border-red-150 bg-red-50/50 rounded-2xl p-4 flex gap-3 text-red-800">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-xs block">
                    {lang === "bn" ? "সাবধানী সতর্কতা! (Irreversible action)" : "Critical Warning"}
                  </span>
                  <p className="text-xs text-red-750 leading-relaxed font-semibold">
                    {lang === "bn" 
                      ? "অ্যাকাউন্ট ডিলিট করলে আপনার আপলোড করা সমস্ত বিজ্ঞাপনের বিজ্ঞাপনকারী তথ্য ও পেমেন্ট হিস্ট্রি অবিলম্ব স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা সম্ভব নয়।" 
                      : "Purging account data deletes all premium parts listings, historical wallets, and profiles. This process is absolutely permanent and cannot be undone."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-extrabold text-sm text-slate-950">
                  {lang === "bn" ? "কোন কোন তথ্য মুছে ফেলা হবে?" : "What data will be wiped?"}
                </h3>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5 font-semibold">
                  <li>{lang === "bn" ? "আপনার নাম, ফোন নম্বর এবং ইমেল প্রোফাইল" : "Your registered name, cellular number, and email details"}</li>
                  <li>{lang === "bn" ? "আপনার আপলোড করা সকল যন্ত্রাংশের বিজ্ঞাপন" : "All classified inventories and uploaded product images"}</li>
                  <li>{lang === "bn" ? "বিজ্ঞাপনের রিভিউ এবং সেলার প্রোফাইল রেকর্ড" : "Associated listing reviews and transaction logs"}</li>
                </ul>
              </div>

              {checkingAuth ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : !isLoggedIn ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-4">
                  <p className="text-xs text-slate-600 font-bold">
                    {lang === "bn" 
                      ? "অ্যাকাউন্ট ডিলিট করতে প্রথমে অ্যাপে লগইন করুন অথবা নোটিফিকেশন সাপোর্ট ইমেইলে যোগাযোগ করুন।" 
                      : "Please standard log in first to trigger the self-served automated database purge helper."}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                    <button
                      onClick={onBack}
                      className="px-5 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
                    >
                      {lang === "bn" ? "হোমে যান" : "Go Home"}
                    </button>
                    <a
                      href="mailto:rjrayhan9191@gmail.com"
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      rjrayhan9191@gmail.com
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-705 block">
                      {lang === "bn" ? "অনুমোদন নিশ্চিত করতে নিচে 'delete' শব্দটি লিখুন:" : "Type 'delete' to authorize execution:"}
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-red-500"
                      placeholder="delete"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-red-650 bg-red-50 p-3 rounded-xl border border-red-150 font-bold">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleDataDeletion}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3.5 rounded-xl transition shadow-lg shadow-red-600/10"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {lang === "bn" ? "আমার ড্যাশবোর্ড ও সকল ডাটা চিরতরে মুছুন" : "Confirm Permanent Erasure & Delete Account"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 sm:px-8 py-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold">
          <div>Gari Bazar Data Safety Protocol</div>
          <button onClick={onBack} className="text-slate-500 hover:underline">
            {lang === "bn" ? "হোমে ফিরে যান" : "Go back"}
          </button>
        </div>

      </div>
    </div>
  );
}
