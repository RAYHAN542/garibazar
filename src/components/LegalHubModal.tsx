import React, { useState } from "react";
import { X, ShieldAlert, FileText, RotateCw, Scale } from "lucide-react";
import { SupportedLanguage } from "../types";

interface LegalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
}

export default function LegalHubModal({ isOpen, onClose, language }: LegalHubModalProps) {
  const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "refund">("privacy");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-55 transition-all duration-300">
      <div className="bg-white text-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden font-sans flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              {language === "bn" ? "আইনি ও পলিসি কেন্দ্র" : "Legal & Compliance Hub"}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {language === "bn" ? "গাড়ি বাজার প্লে স্টোর এবং আইনগত কমপ্লায়েন্স" : "Gari Bazar Play Store and Regulatory Integrity Policies"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 border-b border-slate-200 shrink-0 flex-wrap">
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex-1 min-w-[120px] py-2 px-3 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === "privacy"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {language === "bn" ? "প্রাইভেসি পলিসি" : "Privacy Policy"}
          </button>
          
          <button
            onClick={() => setActiveTab("terms")}
            className={`flex-1 min-w-[120px] py-2 px-3 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === "terms"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            {language === "bn" ? "ব্যবহারের শর্তাবলী" : "Terms of Service"}
          </button>

          <button
            onClick={() => setActiveTab("refund")}
            className={`flex-1 min-w-[120px] py-2 px-3 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === "refund"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <RotateCw className="w-4 h-4" />
            {language === "bn" ? "ফেরত ও রিফান্ড নীতি" : "Return & Refund"}
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs leading-relaxed text-slate-600">
          
          {activeTab === "privacy" && (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                {language === "bn" ? "১. গোপনীয়তা রক্ষা ও সংগৃহীত ডেটা পলিসি" : "1. Information Collection & Privacy Protection"}
              </h4>
              <p>
                {language === "bn"
                  ? "গাড়ি বাজার (Gari Bazar) প্ল্যাটফর্ম ব্যবহারকারীদের তথ্যের সুরক্ষা বজায় রাখার জন্য সম্পূর্ণ প্রতিশ্রুতিবদ্ধ। ডেভেলপার MD RAYHAN কর্তৃক পরিচালিত এই অ্যাপে গুগল প্লে স্টোর পলিসি ও আইনগত সংগতি নিশ্চিত করতে আমাদের ডেটা সংগ্রহ পদ্ধতির বিশদ রূপরেখা নিচে প্রকাশ করছি:"
                  : "Gari Bazar is committed to maintaining the highest standards of data security and transparency. To ensure full compliance with regulatory requirements and Google Play Store Developer policies, our information practices managed by developer MD RAYHAN are detailed below:"}
              </p>
              
              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2 mt-2">
                <span className="font-extrabold text-slate-900 block">
                  {language === "bn" ? "কী কী ব্যক্তিগত ডেটা সংগ্রহ করা হয় ও কেন:" : "What personally identifiable data we collect and why:"}
                </span>
                <ul className="list-disc list-inside space-y-2 bg-white p-3 rounded-xl border border-slate-100">
                  <li>
                    <strong>{language === "bn" ? "মোবাইল ফোন নম্বর:" : "Mobile Phone Numbers:"}</strong>{" "}
                    {language === "bn" 
                      ? "বিক্রেতার আসল অস্তিত্ব নিশ্চিত করতে, জাল বিজ্ঞাপন ও স্প্যাম প্রতিরোধ করতে এবং ক্রেতাদের যোগাযোগের মাধ্যম হিসেবে ফোন নাম্বার সংগ্রহ করা হয়।" 
                      : "Collected strictly to establish verified seller identities, combat spam listings, and facilitate direct communication between buyers and sellers."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "অবস্থান ডেটা (শহর/লোকেশন):" : "Geographic Location Data (City/Region):"}</strong>{" "}
                    {language === "bn" 
                      ? "ভারী গাড়ি পার্টস কেনাবেচায় অপ্রয়োজনীয় শিপিং খরচ ও দূরত্ব কমাতে এবং আপনার নিকটবর্তী শহর অনুযায়ী ফিল্টার সাজানোর সুবিধা দেওয়ার জন্য এটি ব্যবহৃত হয়।" 
                      : "Used to route search queries to nearby parts listings, minimizing expensive physical delivery and shipping logistics across Bangladesh."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "ছবি ও মিডিয়া ফাইলস:" : "Product Photos & Profile Images:"}</strong>{" "}
                    {language === "bn" 
                      ? "বিক্রেতাদের জেনুইন পার্টসের বাস্তব ছবি প্রদর্শনের স্বার্থে পণ্যের ছবি এবং অ্যাকাউন্ট কাস্টমাইজেশনে প্রফাইল ছবি আপলোড করতে হয় যা ফায়ারবেস স্টোরেজে হোস্ট থাকে।" 
                      : "Required for hosting verified car parts advertisements and profile personalization. All images are securely stored on Google Firebase Cloud Storage."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "ফায়ারবেস অথেন্টিকেশন ডেটা:" : "Firebase Authentication Profile:"}</strong>{" "}
                    {language === "bn" 
                      ? "ডিভাইসে লগইন সেশন ধরে রাখতে ফায়ারবেস অথেন্টিকেশন পরিচালিত হয়, যেখানে আপনার লগইন মেথড (যেমন ওটিপি ফোন নম্বর বা ইমেইল) এবং ইউনিক ইউজার আইডি (UID) নথিভুক্ত থাকে।" 
                      : "Provides secure token-based user logins, managing authenticated sessions through Google Firebase Auth while saving unique Firebase User UIDs."}
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "২. ডেটা ডিলিট বা প্রত্যাহারের অনুরোধ" : "2. Data Deletion and Account Removal"}</span>
                <p>
                  {language === "bn"
                    ? "গাবার প্লে স্টোর নির্দেশিকা মেনে আমরা ব্যবহারকারীদের অধিকারকে সর্বোচ্চ প্রাধান্য দেই। যেকোনো সময় লগইনকৃত ড্যাশবোর্ড থেকে অ্যাকাউন্ট ডিলিট করতে পারেন অথবা সরাসরি rjrayhan9191@gmail.com বা sadakalo7373@gmail.com ইমেইলে আবেদনের মাধ্যমে স্থায়ীভাবে ডাটা মুছে ফেলার অনুরোধ পাঠাতে পারেন।"
                    : "Consistent with Google Play Store standards, users retain total control over their data. You can delete your account instantly from your active Dashboard profile settings, or write to our support desk to purge all associated files and listings within 24-48 hours."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৩. ডেটা শেয়ারিং এবং থার্ড-পার্টি ডিসক্লোজার" : "3. Third-Party Sharing Policies"}</span>
                <p>
                  {language === "bn"
                    ? "আমরা কোনো ব্যক্তিগত তথ্য বা ট্র্যাকিং ডাটা বাহ্যিক বিজ্ঞাপনী সংস্থা বা থার্ড পার্টি প্রতিষ্ঠানের কাছে বিক্রি করি না। আপনার মোবাইল নম্বর কেবল গাড়ি পার্টস বিক্রয়ের যোগাযোগের উদ্দেশ্যে ক্রেতাদের নিকট প্রদর্শিত হয়ে থাকে।"
                    : "We enforce a strict zero-sharing policy. Personally identifiable variables are never shared, leased, or distributed with third-party tracking nets or marketing providers."}
                </p>
              </div>
            </div>
          )}

          {activeTab === "terms" && (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                {language === "bn" ? "ব্যবহারের সাধারণ শর্তাবলী" : "General Terms of Service"}
              </h4>
              <p>
                {language === "bn"
                  ? "গাড়ি বাজার মোবাইল অ্যাপটি ইন্সটল অথবা ব্যবহার করার মাধ্যমে আপনি নিম্নলিখিত শর্তাবলী মেনে নিতে সম্মত হচ্ছেন:"
                  : "By installing, accessing, or utilizing the Gari Bazar application, you acknowledge agreement with these binding terms:"}
              </p>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "১. বিক্রেতার সুনীতি ও বাধ্যবাধকতা" : "1. Seller Guidelines & Responsibilities"}</span>
                <p>
                  {language === "bn"
                    ? "বিক্রেতাদের কেবল বৈধ গাড়ি পার্টস এবং স্পেয়ার্স আইটেম পোস্ট করতে হবে। কোনো চোরাই মালামাল, ত্রুটিযুক্ত ফেক বা অবৈধ পণ্য পোস্ট করা হলে অ্যাকাউন্ট চিরতরে স্থগিত করা হবে। সকল পণ্যের মূল্য ও বিবরণ স্পষ্ট এবং সঠিক হওয়া আবশ্যক।"
                    : "Sellers must list only genuine automative parts and spares actually in stock. Any presentation of counterfeit goods, fraudulent pricing details, or stolen items will result in immediate termination of trading access."}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "২. ভার্চুয়াল ওয়ালেট এবং বিলিং ক্রেডিট" : "2. Virtual Wallets & Marketing Credits"}</span>
                <p>
                  {language === "bn"
                    ? "অ্যাপে দৃশ্যমান ব্যালেন্স (simulatedCredits) বিজ্ঞাপন বুস্ট করার এবং মার্কেটিং ফিচারের ডেমো পরীক্ষার জন্য ব্যবহৃত চিপস। এগুলো কোনো আসল ক্রিপ্টোকারেন্সি বা রিয়েল মানি অলটারনেটিভ নয়।"
                    : "Platform credits (simulatedCredits) are virtual units provided solely for sandbox testing and ad boosting visualization. Credits do not possess physical real-money exchange value."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৩. দায়বদ্ধতা সীমাবদ্ধকরণ" : "3. Limitation of Liability"}</span>
                <p>
                  {language === "bn"
                    ? "গাড়ি বাজার একটি উন্মুক্ত বিজ্ঞাপনী বাজার। ক্রেতা ও বিক্রেতার মধ্যস্থ টাকা-পয়সা লেনদেনের কোনো ত্রুটি বা পণ্য বিতরণের কোনো ক্ষয়-ক্ষতিতে গাড়ি বাজার কোনো আইনি দায়ভার বহন করবে না। সরাসরি দেখা করে পণ্য যাচাই করে ক্রয়ের জন্য ক্রেতাদের অনুরোধ করা যাচ্ছে।"
                    : "Gari Bazar operates as an peer-to-peer advertising index. We disclaim all civil and financial liability for transaction failures, delivery disputes, or description mismatch between independent buyers and sellers."}
                </p>
              </div>
            </div>
          )}

          {activeTab === "refund" && (
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                {language === "bn" ? "ফেরত ও প্রমোশন চার্জ রিফান্ড নীতি" : "Return & Purchase Refund Policies"}
              </h4>
              <p>
                {language === "bn"
                  ? "যেহেতু গাড়ি বাজার অ্যাপে বুস্টিং এবং রিচার্জ ওয়ালেটের জন্য ডেমো স্যান্ডবক্স পেমেন্ট পদ্ধতি ব্যবহার করা হচ্ছে, আমরা আমাদের আইনি পরিচ্ছন্নতা বজায় রাখার জন্য একটি সুনির্দিষ্ট নীতি প্রদান করছি:"
                  : "To establish a transparent compliance relationship with our users, we maintain a clear refund and transaction resolution protocol:"}
              </p>

              <div className="space-y-2 bg-indigo-50/50 border border-indigo-150 p-4 rounded-2xl text-indigo-950">
                <span className="font-extrabold text-indigo-900 block">{language === "bn" ? "১. ডিজিটাল গেটওয়ে স্যান্ডবক্স ডিসক্লোজার" : "1. Digital Gateway Sandbox Protocols"}</span>
                <p>
                  {language === "bn"
                    ? "আমাদের পেমেন্ট পোর্টালটি গুগল প্লে স্টোরের ডেমো পরীক্ষার সুবিধার্থে এবং অ্যাপের কার্যক্ষমতা মূল্যায়নের জন্য কেবল একটি সিমুলেশন চালনা করে। কোনো আসল টাকা কর্তন না হওয়ায় এর কোনো আসল রিফান্ড আবেদন প্রযোজ্য নয়।"
                    : "In line with pre-production sandboxing regulations, transactions processed within the mock gateway are simulated for review purposes. Because no real currency changes hands, standard monetary refunds are not issued."}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "২. প্রমোশন এবং বিজ্ঞাপন বুস্ট রিফান্ড নীতি" : "2. Paid Package and Ad Promotion Upgrades"}</span>
                <p>
                  {language === "bn"
                    ? "যদি কোনো ব্যবহারকারী ভুলক্রমে ডেমো প্রক্সি ব্যবহার করে বিজ্ঞাপন আপগ্রেড করে থাকেন এবং বিজ্ঞাপনটি দৃশ্যমান করতে ব্যর্থ হন, তাহলে অ্যাডমিন প্যানেল থেকে পুনরায় বিনামূল্যে রিফিল ব্যালেন্স প্রদান করা হবে।"
                    : "For testing of promotional packages, if a test upgrade token encounters activation issues, users can instantly request free manual refill credits from the Admin Panel widget."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৩. কাস্টমার সাপোর্ট ও হেল্প ডেস্ক" : "3. Dispute Resolution Contacts"}</span>
                <p>
                  {language === "bn"
                    ? "যেকোনো অসঙ্গতি দূর করতে অথবা কোনো ফেক বিজ্ঞাপনের বিরুদ্ধে অভিযোগ জানাতে sadakalo7373@gmail.com ঠিকানায় ইমেইল পাঠান। ২৪ ঘণ্টার মধ্যে ব্যবস্থা গ্রহণ করা হবে।"
                    : "For any compliance issues, developer concerns, or to report a fraudulent listing, please immediately reach out to our helpdesk at sadakalo7373@gmail.com. We respond within 24 hours."}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Version 1.0.4 - Secure Built</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            {language === "bn" ? "আমি পড়েছি ও সম্মত" : "Done / I Agree"}
          </button>
        </div>

      </div>
    </div>
  );
}
