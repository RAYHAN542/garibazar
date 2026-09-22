import React, { useState } from "react";
import { ShieldCheck, Calendar, Mail, ArrowLeft, Globe, Printer } from "lucide-react";
import { SupportedLanguage } from "../types";

interface PrivacyPolicyPageProps {
  language?: SupportedLanguage;
  onBack?: () => void;
  standalone?: boolean;
}

export default function PrivacyPolicyPage({ 
  language: initialLanguage = "bn", 
  onBack, 
  standalone = false 
}: PrivacyPolicyPageProps) {
  const [lang, setLang] = useState<SupportedLanguage>(initialLanguage);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 ${standalone ? "py-8 px-4 sm:px-6 lg:px-8" : "p-0"}`}>
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        
        {/* Header Block */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 sm:px-10 py-8 shrink-0 relative">
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
                className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors cursor-pointer bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/30"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {lang === "bn" ? "ফিরে যান" : "Go Back"}
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-0.5">
                  Gari Bazar - Privacy Policy
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  {lang === "bn" ? "প্রাইভেসি পলিসি ও তথ্য সুরক্ষা নির্দেশিকা" : "Privacy Policy & Information Protection Charter"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-medium">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" />
                {lang === "bn" ? "সর্বশেষ আপডেট: ২০ জুন, ২০২৬" : "Last Updated: June 20, 2026"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3 text-indigo-400" />
                rjrayhan9191@gmail.com
              </span>
              <button 
                onClick={handlePrint}
                className="ml-auto inline-flex items-center gap-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-500/20 transition text-[10px] font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                {lang === "bn" ? "প্রিন্ট করুন" : "Print Policy"}
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-10 space-y-8 font-sans leading-relaxed text-sm text-slate-650">
          
          {lang === "bn" ? (
            /* BENGALI PRIVACY POLICY */
            <>
              <section className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  গোপনীয়তা চুক্তি ও ভূমিকা
                </h2>
                <p>
                  <strong>গাড়ি বাজার (Gari Bazar)</strong> একটি অনলাইন গাড়ি এবং বাইকের পার্টস কেনাবেচার মার্কেটপ্লেস অ্যাপ হিসেবে পরিচালিত হয়। 
                  নিরাপদ ও বিশ্বস্ত মাধ্যম বজায় রাখার লক্ষ্যে ডেভেলপার <strong>MD RAYHAN</strong> আমাদের ব্যবহারকারীদের তথ্য সুরক্ষার ব্যাপারে সর্বোচ্চ প্রতিশ্রুতিবদ্ধ। 
                  প্লে স্টোর পলিসি ও নিয়ম অনুযায়ী, ব্যবহারকারী যখন আমাদের অ্যাপ বা প্ল্যাটফর্মটি ব্যবহার করেন, তখন কী ধরনের তথ্য কীভাবে সংগৃহীত, সংরক্ষিত এবং প্রক্রিয়াজাত করা হয় তার বিশদ বিবরণ এ প্রাইভেসি পলিসিতে দেওয়া হয়েছে।
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ১. আমরা কী কী ব্যক্তিগত তথ্য সংগ্রহ করি এবং কেন?
                </h2>
                <p>
                  আমাদের অ্যাপ্লিকেশনের নির্বিঘ্ন সেবা এবং জেনুইন ক্রেতা-বিক্রেতার মধ্যকার আস্থা নিশ্চিত করতে আমরা প্রধানত নিচের তথ্যগুলো সংগ্রহ করে থাকি:
                </p>

                <div className="space-y-4 pt-2">
                  {/* Phone Number */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      ক) মোবাইল ফোন নম্বর (User Phone Numbers)
                    </span>
                    <p className="text-xs">
                      <strong>উদ্দেশ্য:</strong> পার্টস কিনতে বা বিক্রি করতে ইচ্ছুক ব্যবহারকারীদের সঠিক পরিচয় যাচাই নিশ্চিত করতে ফোন নম্বর দিয়ে সাইন-ইন/ভেরিফিকেশন সম্পন্ন করা হয়। 
                      তাছাড়া কোনো পার্ট পছন্দ হলে ক্রেতা সরাসরি বিক্রেতার দেওয়ার ফোন নম্বরে যোগাযোগ করার সুবিধার্থেই এটি সংগ্রহ ও প্রদর্শন করা হয়।
                    </p>
                  </div>

                  {/* Location Data */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      খ) অবস্থান সংক্রান্ত ডেটা (Geographic Location / City)
                    </span>
                    <p className="text-xs">
                      <strong>উদ্দেশ্য:</strong> সম্পূর্ণ বাংলাদেশে গাড়ির পার্টস কেনাবেচা সহজ করতে আমরা ব্যবহারকারীর শহর (Location/City) নির্বাচন সংক্রান্ত ডেটা সংগ্রহ করি। 
                      এর মাধ্যমে ব্যবহারকারী তার নিজ এলকার বা নিকটবর্তী শহরের খুচরা বিক্রেতা বা শোরুম থেকে সহজে পার্টস খুঁজে বের করতে সক্ষম হন এবং পণ্য ডেলিভারি প্রক্রিয়া লাভদায়ক হয়।
                    </p>
                  </div>

                  {/* Photos and Images */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      গ) ছবি ও ফাইল আপলোড (Photos and Listing Images)
                    </span>
                    <p className="text-xs">
                      <strong>উদ্দেশ্য:</strong> বিক্রেতা যখন কোনো গাড়ির পার্টসের বিজ্ঞাপন (Listing) যুক্ত করেন, তখন ক্রেতাদের দেখানোর জন্য পণ্যের আসল ছবি আপলোড করতে হয়। 
                      এছাড়াও প্রফাইল কাস্টমাইজেশনে ছবির প্রয়োজন হতে পারে। এই ছবিগুলো আমাদের ক্লাউড স্টোরেজে সুরক্ষিতভাবে হোস্ট করা থাকে এবং লিস্টিং আকারে অন্যান্য পাবলিক ব্যবহারকারীদের প্রদর্শন করা হয়।
                    </p>
                  </div>

                  {/* Firebase Auth Data */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      ঘ) ফায়ারবেস অথেন্টিকেশন তথ্য (Firebase Authentication Profile)
                    </span>
                    <p className="text-xs">
                      <strong>উদ্দেশ্য:</strong> ব্যবহারকারীদের ডিভাইসে নিরাপদ লগইন এবং সেশন ধরে রাখতে আমরা গুগল ফায়ারবেস অথেন্টিকেশন (Firebase Authentication) ব্যবহার করি। 
                      এর আওতায় আপনার লগইন মেথড (যেমন ফোন ওটিপি বা ইমেইল) এবং ইউনিক ইউজার আইডি (UID) সংগ্রহ করা হয় যা ডেটাবেসে আপনার বিজ্ঞাপনের মালিকানা পরিচালনা করার জন্য ব্যবহৃত হয়।
                    </p>
                  </div>

                  {/* Device ID & Email Disclosures */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      ঙ) ইমেল, ডিভাইস আইডি ও ডাটা সিকিউরিটি পার্টনার
                    </span>
                    <p className="text-xs">
                      <strong>সংগৃহীত ডাটা:</strong> ইমেল ঠিকানা, ডিভাইস আইডি (অ্যান্ড্রয়েড আইডি / ইনস্টলেশন আইডি), এবং আপলোডকৃত পার্টস এর ফটো।<br />
                      <strong>উদ্দেশ্য:</strong> ডিভাইস আইডি স্প্যাম প্রতিরোধ ও অ্যাপ পারফরমেন্স ট্র্যাক করতে ব্যবহৃত হয়। আপনার তথ্য কেবল অ্যাকাউন্ট পরিচালনা, বিজ্ঞাপন (Listings) এবং ক্রেতা-বিক্রেতার ডিরেক্ট যোগাযোগের কাজেই ব্যবহৃত হয়।<br />
                      <strong>ডাটা ধারণ সীমা (Retention):</strong> আপনার ব্যবহারের সমস্ত তথ্য অ্যাকাউন্ট ডিলিট করা পর্যন্ত সংরক্ষিত থাকবে। অ্যাকাউন্ট ডিলিট করলে তা চিরতরে মুছে ফেলা হবে।<br />
                      <strong>থার্ড-পার্টি সার্ভিস পার্টনার:</strong> ডাটা সংরক্ষণে গুগল ফায়ারবেস (Firebase) এবং স্মার্ট বিবরণী জেনারেটরে গুগল জেমিনি (Gemini API) ব্যবহার করা হয়।
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ২. তথ্যের ব্যবহার পদ্ধতি ও বণ্টন
                </h2>
                <p>
                  সংগৃহীত তথ্যসমূহ নিম্নলিখিত উপায়ে ব্যবহৃত হয়:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs">
                  <li>ব্যবহারকারীর অ্যাকাউন্ট তৈরি ও প্লে স্টোর মার্কেটপ্লেস সেবা পরিচালনা ও টেকনিক্যাল সাপোর্ট দেওয়া।</li>
                  <li>স্পেয়ার পার্টসের বিজ্ঞাপন তৈরি ও কাছাকাছি অঞ্চলের ক্রেতাদের সুবিধার্থে লিস্টিং সাজানো।</li>
                  <li>জাল লিস্টিং, স্প্যাম অ্যাকাউন্ট ও সিকিউরিটি ব্রিজ ঠেকাতে এবং প্রকৃত বিক্রেতাদের ফোন নম্বর দিয়ে কমিউনিটি রক্ষা।</li>
                  <li>ব্যবহারকারীর সম্মতি এবং অনুরোধ ব্যতীত কখনোই বিজ্ঞাপন বা অন্য কোনো থার্ড-পার্টি ট্র্যাকিং নেটওয়ার্কের সাথে কোনো ব্যক্তিগত ডাটা বিনিময় বা বিক্রি করা হয় না।</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ৩. ডেটা স্টোরেজ ও নিরাপত্তা (Storage & Security)
                </h2>
                <p>
                  আমরা আপনার সমস্ত লিস্টিং, অবস্থান এবং প্রফাইল তথ্য <strong>গুগল ফায়ারবেস ফায়ারস্টোর (Google Firebase Firestore)</strong> ক্লাউড প্রযুক্তির মাধ্যমে সুরক্ষিত অবস্থায় সংরক্ষণ করি। 
                  অননুমোদিত প্রবেশ ঠেকাতে আমরা কঠোর সিকিউরিটি রুলস (Firestore Security Rules) এবং এসএসএল ট্রান্সমিশন এনক্রিপশন ব্যবহার করি।
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ৪. ব্যবহারকারীর অ্যাকাউন্টের সম্পূর্ণ তথ্য মুছে দেওয়ার অধিকার
                </h2>
                <p>
                  গুগল প্লে স্টোর ডেটা ডিলিট পলিসি মেনে ব্যবহারকারীর অধিকারকে সর্বোচ্চ সম্মান জানানো হয়। যেকোনো ব্যবহারকারী চাইলে অ্যাপের ড্যাশবোর্ড থেকে তাৎক্ষণিকভাবে অ্যাকাউন্ট ডিলিট করতে পারেন। 
                  তা ছাড়া আপনার সমস্ত বিজ্ঞাপন ও ব্যক্তিগত ডাটা সম্পূর্ণ মুছে ফেলার অনুরোধ করতে আমাদের ডেভেলপার ইমেইলে সরাসরি মেসেজ পাঠাতে পারেন। অনুরোধ পাওয়ার ২৪-৪৮ ঘণ্টার মধ্যে ডেটাবেস থেকে সংশ্লিষ্ট সমস্ত রেকর্ড স্থায়ীভাবে ডিলিট করা হবে।
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ৫. শিশুদের গোপনীয়তা রক্ষা (Children’s Privacy)
                </h2>
                <p>
                  আমাদের এই কার্যক্রম ১৮ বছরের কম বয়সী শিশুদের লক্ষ্য করে পরিচালিত নয় এবং জেনুইন কার পার্টস ডিল করার জন্য কেবল সাবালক নাগরিকরাই এটি ব্যবহার করবেন। 
                  আমরা জেনেশুনে কখনো অপ্রাপ্তবয়স্ক ব্যবহারকারীদের কোনো ব্যক্তিগত তথ্য সংগ্রহ করি না।
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  ৬. কন্টাক্ট এবং আমাদের সাথে যোগাযোগের ঠিকানা
                </h2>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs">
                    প্রাইভেসি পলিসি সংক্রান্ত কোনো উদ্বেগ অথবা অভিযোগ থাকলে আমাদের নিচের ঠিকানায় ইমেইল পাঠান:
                  </p>
                  <ul className="text-xs space-y-1 font-bold text-slate-800">
                    <li>ডেভেলপার নাম: MD RAYHAN</li>
                    <li>দেশ: বাংলাদেশ</li>
                    <li>যোগাযোগ ইমেইল: <a href="mailto:rjrayhan9191@gmail.com" className="text-indigo-600 hover:underline">rjrayhan9191@gmail.com</a></li>
                  </ul>
                </div>
              </section>
            </>
          ) : (
            /* ENGLISH PRIVACY POLICY */
            <>
              <section className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  Agreement & Scope
                </h2>
                <p>
                  This Privacy Policy document discloses the information practices of <strong>Gari Bazar</strong>, 
                  a peer-to-peer automotive parts marketplace application built by developer <strong>MD RAYHAN</strong>. 
                  We are deeply committed to protecting the integrity and confidentiality of your personal information. 
                  By downloading, registering, or facilitating trades within Gari Bazar, you agree to the collection, hosting, 
                  and usage practices specified in this Google Play Developer policy-compliant charter.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  1. Information We Collect and Its Logical Necessity
                </h2>
                <p>
                  To secure user authorizations, combat fraudulent trade advertisements, and enable direct negotiations 
                  between authentic parts buyers and sellers, we capture the following details:
                </p>

                <div className="space-y-4 pt-2">
                  {/* Phone Number */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      A) User Phone Numbers
                    </span>
                    <p className="text-xs">
                      <strong>Purpose & Necessity:</strong> Phone numbers are collected to authenticate users and prevent fraudulent multi-account generation. 
                      Because Gari Bazar functions as a direct classified catalog for automobile parts, the phone number also serves as the primary contact gateway 
                      for potential buyers to negotiate and organize logistics directly with you.
                    </p>
                  </div>

                  {/* Location Data */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      B) Geographic Location Data (City / Division)
                    </span>
                    <p className="text-xs">
                      <strong>Purpose & Necessity:</strong> Auto parts are heavy physical assets. To filter and display spare listings within local proximity 
                      and prevent expensive long-range shipping errors across Bangladesh, the application logs the user’s self-declared city or active region.
                    </p>
                  </div>

                  {/* Photos and Images */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      C) Uploaded Listing Images & Photos
                    </span>
                    <p className="text-xs">
                      <strong>Purpose & Necessity:</strong> Sellers must upload photo assets of actual engine components, transmission packages, or bumpers 
                      to confirm listing authenticity. These images are transmitted securely to Google Firebase Cloud Storage and visible to public listing queries.
                    </p>
                  </div>

                  {/* Firebase Auth Data */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      D) Firebase Authentication Data
                    </span>
                    <p className="text-xs">
                      <strong>Purpose & Necessity:</strong> We use Google Firebase Authentication for session management and login validation. 
                      This stores the authentication metadata, profile attributes, and unique Firestore User ID (UID) necessary to securely associate listings 
                      and wallet credits to your authenticated terminal.
                    </p>
                  </div>

                  {/* Device ID & Email Disclosures */}
                  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
                    <span className="font-extrabold text-slate-900 text-xs text-indigo-600 uppercase tracking-wider block">
                      E) Email, Device ID, and Storage Lifespans
                    </span>
                    <p className="text-xs">
                      <strong>Data Collected:</strong> Email address, Device ID (Android ID or Installation ID), and uploaded parts photos.<br />
                      <strong>Purposes:</strong> Device IDs prevent multiple bot registrations and secure performance auditing. All collected data is strictly used for account management, listing setups, and customer-seller direct contact.<br />
                      <strong>Retention Policy:</strong> All PII remains hosted strictly until account deletion. Immediate complete purge occurs upon trigger.<br />
                      <strong>Third-Party Partners:</strong> Storage and user accounts are processed via Google Firebase. Intelligent automated text assistance is facilitated through Google Gemini APIs. No marketing agencies or aggregate trackers are ever utilized.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  2. Use and Protection of Information
                </h2>
                <p>
                  Your information is processed to improve the Gari Bazar app services. We enforce these data guidelines:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs">
                  <li>To establish account authentication, manage user profiles, and resolve dispute requests.</li>
                  <li>To display parts listings with correct geographic filters for surrounding consumers.</li>
                  <li>To block bot accounts, malicious advertising scripts, and counterfeit listings.</li>
                  <li><strong>Zero Distribution Policy:</strong> Gari Bazar does not share, trade, rent, or distribute any user data with external advertising aggregators or third-party marketing services.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  3. Cloud Services & Data Architecture
                </h2>
                <p>
                  All database and user records are stored securely in <strong>Google Firebase/Firestore</strong> servers. 
                  We deploy automated Firebase Auth protection layers, encryption-in-transit (HTTPS/SSL), and explicit security rules to prevent information leaks.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  4. Explicit Account Deletion and Data Purge Rights
                </h2>
                <p>
                  In compliance with Google Play Developer Console requirement paradigms, users retain complete autonomy over their data. 
                  You can purge your profile, inventory, and registered records instantly via the Account Dashboard tools in Gari Bazar. 
                  Alternatively, write to our official helpdesk at <a href="mailto:rjrayhan9191@gmail.com" className="text-indigo-600 hover:underline">rjrayhan9191@gmail.com</a>, 
                  and your data will be permanently cleared from active storage within 24-48 hours.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  5. Compliance Inquiries & Developer Contacts
                </h2>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs">
                    Please submit any privacy audit questions, legal notices, or feedback regarding data policies to:
                  </p>
                  <ul className="text-xs space-y-1 font-bold text-slate-805">
                    <li>Developer: MD RAYHAN</li>
                    <li>Jurisdiction: Bangladesh</li>
                    <li>Official Email: <a href="mailto:rjrayhan9191@gmail.com" className="text-indigo-600 hover:underline">rjrayhan9191@gmail.com</a></li>
                  </ul>
                </div>
              </section>
            </>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 sm:px-10 py-5 border-t border-slate-100 shrink-0 flex items-center justify-between">
          <div className="text-[10px] text-slate-400 font-bold tracking-tight">
            Gari Bazar • Play Store Compliant
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {lang === "bn" ? "ঠিক আছে, ফিরে যান" : "Okay, Go Back"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
