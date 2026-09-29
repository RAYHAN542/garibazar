import React, { useState } from "react";
import { X, ShieldAlert, FileText, Loader2, Scale, ArrowLeft } from "lucide-react";
import { SupportedLanguage } from "../types";

interface LegalHubModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  language: SupportedLanguage;
  standalone?: boolean;
  initialTab?: "privacy" | "terms" | "refund";
  onBack?: () => void;
}

export default function LegalHubModal({ isOpen = true, onClose, language, standalone = false, initialTab = "privacy", onBack }: LegalHubModalProps) {
  const [activeTab, setActiveTab] = useState<"privacy" | "terms" | "refund">(initialTab);

  if (!standalone && !isOpen) return null;

  return (
    <div className={standalone
      ? "min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8"
      : "fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-55 transition-all duration-300"
    }>
      <div className={standalone
        ? "bg-white text-slate-800 rounded-3xl max-w-2xl w-full mx-auto shadow-xl border border-slate-200 overflow-hidden font-sans flex flex-col"
        : "bg-white text-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden font-sans flex flex-col max-h-[85vh]"
      }>
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
          <div>
            {standalone && onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mb-2 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {language === "bn" ? "ফিরে যান" : "Go Back"}
              </button>
            )}
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              {language === "bn" ? "আইনি ও পলিসি কেন্দ্র" : "Legal & Compliance Hub"}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {language === "bn" ? "গাড়ি বাজার প্লে স্টোর এবং আইনগত কমপ্লায়েন্স" : "Gari Bazar Play Store and Regulatory Integrity Policies"}
            </p>
          </div>
          {!standalone && (
            <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          )}
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
            <Loader2 className="w-4 h-4" />
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
                  ? "গাড়ি বাজার (Gari Bazar) প্ল্যাটফর্ম ব্যবহারকারীদের তথ্যের সুরক্ষা বজায় রাখার জন্য সম্পূর্ণ প্রতিশ্রুতিবদ্ধ। ডেভেলপার MD RAYHAN কর্তৃক পরিচালিত এই অ্যাপে আমরা কোন তথ্য সংগ্রহ করি তার সংক্ষিপ্ত রূপরেখা নিচে দেওয়া হলো। সম্পূর্ণ প্রাইভেসি পলিসি পাওয়া যাবে garibazar.shop/privacy-policy পেজে:"
                  : "Gari Bazar is committed to maintaining the highest standards of data security and transparency. A summary of the information practices of this app, managed by developer MD RAYHAN, is below. The full Privacy Policy is available at garibazar.shop/privacy-policy:"}
              </p>
              
              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2 mt-2">
                <span className="font-extrabold text-slate-900 block">
                  {language === "bn" ? "কী কী ব্যক্তিগত ডেটা সংগ্রহ করা হয় ও কেন:" : "What personally identifiable data we collect and why:"}
                </span>
                <ul className="list-disc list-inside space-y-2 bg-white p-3 rounded-xl border border-slate-100">
                  <li>
                    <strong>{language === "bn" ? "নাম ও মোবাইল ফোন নম্বর:" : "Name & Mobile Phone Number:"}</strong>{" "}
                    {language === "bn" 
                      ? "মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খোলা ও লগইন করা হয়। এটি বিক্রেতার আসল অস্তিত্ব নিশ্চিত করতে, জাল বিজ্ঞাপন ও স্প্যাম প্রতিরোধ করতে এবং ক্রেতাদের যোগাযোগের মাধ্যম হিসেবে ব্যবহৃত হয়।" 
                      : "You create an account and sign in with your phone number and a password. This is used to establish verified seller identities, combat spam listings, and let buyers contact sellers directly."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "অবস্থান ডেটা (শহর/লোকেশন):" : "Geographic Location Data (City/Region):"}</strong>{" "}
                    {language === "bn" 
                      ? "আপনার নিজের উল্লেখ করা শহর বা এলাকা, যাতে নিকটবর্তী ক্রেতা-বিক্রেতা খুঁজে পাওয়া যায়। অ্যাপ ফোনের GPS বা সঠিক লোকেশন সংগ্রহ করে না।" 
                      : "The city or area you state yourself, used to route search queries to nearby listings. The app does not collect your phone's GPS or precise location."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "ছবি ও মিডিয়া ফাইলস:" : "Product Photos & Profile Images:"}</strong>{" "}
                    {language === "bn" 
                      ? "পণ্যের ছবি এবং প্রোফাইল ছবি আপলোড করা হয় যা Cloudinary-তে হোস্ট থাকে। লিস্টিংয়ের ছবি অন্য ব্যবহারকারীদের দেখানো হয়।" 
                      : "Product photos and profile images are uploaded and hosted on Cloudinary. Listing photos are shown to other users."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "অ্যাকাউন্ট ও লগইন ডেটা:" : "Account & Sign-in Data:"}</strong>{" "}
                    {language === "bn" 
                      ? "লগইন সেশন ধরে রাখতে Supabase Authentication ব্যবহৃত হয়, যেখানে আপনার ইউনিক ইউজার আইডি নথিভুক্ত থাকে এবং পাসওয়ার্ড নিরাপদভাবে হ্যাশ করে রাখা হয়।" 
                      : "Supabase Authentication manages your login session and stores your unique user ID; your password is securely hashed."}
                  </li>
                  <li>
                    <strong>{language === "bn" ? "চ্যাট মেসেজ ও ব্যবহারের তথ্য:" : "Chat Messages & Usage Data:"}</strong>{" "}
                    {language === "bn" 
                      ? "ক্রেতা-বিক্রেতার চ্যাট মেসেজ, রিপোর্ট/ব্লকের তথ্য এবং স্প্যাম ঠেকাতে ও ব্যবহারের পরিসংখ্যান বুঝতে একটি ডিভাইস বা ইনস্টলেশন আইডি সংগ্রহ করা হয়।" 
                      : "Chat messages between buyers and sellers, report/block information, and a device or installation ID used to prevent spam and understand usage statistics."}
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "২. ডেটা ডিলিট বা প্রত্যাহারের অনুরোধ" : "2. Data Deletion and Account Removal"}</span>
                <p>
                  {language === "bn"
                    ? "গুগল প্লে স্টোর নির্দেশিকা মেনে আমরা ব্যবহারকারীদের অধিকারকে সর্বোচ্চ প্রাধান্য দেই। যেকোনো সময় লগইনকৃত ড্যাশবোর্ড থেকে অ্যাকাউন্ট ডিলিট করতে পারেন, garibazar.shop/delete-account পেজে অনুরোধ করতে পারেন, অথবা rjrayhan9191@gmail.com বা sadakalo7373@gmail.com ইমেইলে আবেদন পাঠাতে পারেন। ২৪-৪৮ ঘণ্টার মধ্যে ডাটা স্থায়ীভাবে মুছে ফেলা হয়।"
                    : "Consistent with Google Play Store standards, users retain total control over their data. You can delete your account instantly from your Dashboard profile settings, request deletion at garibazar.shop/delete-account, or write to our support desk. All associated data is permanently purged within 24-48 hours."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৩. ডেটা শেয়ারিং এবং থার্ড-পার্টি ডিসক্লোজার" : "3. Third-Party Sharing Policies"}</span>
                <p>
                  {language === "bn"
                    ? "আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না। আপনার মোবাইল নম্বর গাড়ি পার্টস বিক্রয়ের যোগাযোগের উদ্দেশ্যে আগ্রহী ক্রেতাদের দেখানো হয়। আমাদের হয়ে তথ্য প্রক্রিয়াকরণকারী সেবাদাতা: Supabase, Google Firebase, Cloudinary, Vercel এবং পেমেন্টের জন্য UddoktaPay/bKash। ওয়েবসাইটে Google AdSense ও Adsterra-র তৃতীয় পক্ষের বিজ্ঞাপন দেখানো হতে পারে; অ্যান্ড্রয়েড অ্যাপে বর্তমানে কোনো তৃতীয় পক্ষের বিজ্ঞাপন নেই।"
                    : "We do not sell your personal information. Your phone number is shown to interested buyers so they can contact sellers. Service providers that process data on our behalf: Supabase, Google Firebase, Cloudinary, Vercel, and UddoktaPay/bKash for payments. The website may show third-party ads from Google AdSense and Adsterra; the Android app currently shows no third-party ads."}
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
                  ? "গাড়ি বাজার মোবাইল অ্যাপটি ইন্সটল অথবা ব্যবহার করার মাধ্যমে আপনি নিম্নলিখিত শর্তাবলী মেনে নিতে সম্মত হচ্ছেন:"
                  : "By installing, accessing, or utilizing the Gari Bazar application, you acknowledge agreement with these binding terms:"}
              </p>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "১. বিক্রেতার সুনীতি ও বাধ্যবাধকতা" : "1. Seller Guidelines & Responsibilities"}</span>
                <p>
                  {language === "bn"
                    ? "বিক্রেতাদের কেবল বৈধ গাড়ি পার্টস এবং স্পেয়ার্স আইটেম পোস্ট করতে হবে। কোনো চোরাই মালামাল, ত্রুটিযুক্ত ফেক বা অবৈধ পণ্য পোস্ট করা হলে অ্যাকাউন্ট চিরতরে স্থগিত করা হবে। সকল পণ্যের মূল্য ও বিবরণ স্পষ্ট এবং সঠিক হওয়া আবশ্যক।"
                    : "Sellers must list only genuine automative parts and spares actually in stock. Any presentation of counterfeit goods, fraudulent pricing details, or stolen items will result in immediate termination of trading access."}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "২. ভার্চুয়াল ক্রেডিট" : "2. Virtual Credits"}</span>
                <p>
                  {language === "bn"
                    ? "অ্যাপে দৃশ্যমান ক্রেডিট হলো গাড়ি বাজারের ভেতরে বিজ্ঞাপন বুস্ট ও প্রমোশনাল ফিচার ব্যবহারের ভার্চুয়াল ইউনিট। এগুলো নগদ টাকা বা ক্রিপ্টোকারেন্সি নয় এবং তুলে নেওয়া যায় না।"
                    : "Platform credits are virtual units used only inside Gari Bazar to boost ads and use promotional features. They are not cash or cryptocurrency and cannot be withdrawn."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৩. দায়বদ্ধতা সীমাবদ্ধকরণ" : "3. Limitation of Liability"}</span>
                <p>
                  {language === "bn"
                    ? "গাড়ি বাজার একটি উন্মুক্ত বিজ্ঞাপনী বাজার। ক্রেতা ও বিক্রেতার মধ্যস্থ টাকা-পয়সা লেনদেনের কোনো ত্রুটি বা পণ্য বিতরণের কোনো ক্ষয়-ক্ষতিতে গাড়ি বাজার কোনো আইনি দায়ভার বহন করবে না। সরাসরি দেখা করে পণ্য যাচাই করে ক্রয়ের জন্য ক্রেতাদের অনুরোধ করা যাচ্ছে।"
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
                  ? "গাড়ি বাজারে বিজ্ঞাপন প্রচার সংক্রান্ত পেমেন্ট আমাদের পেমেন্ট পার্টনার UddoktaPay ও bKash-এর মাধ্যমে প্রক্রিয়াজাত হয়। পেমেন্ট ও রিফান্ড নিয়ে আমাদের নীতি নিচে দেওয়া হলো:"
                  : "Payments for ad promotion on Gari Bazar are processed by our payment partners UddoktaPay and bKash. Our payment and refund approach is below:"}
              </p>

              <div className="space-y-2 bg-indigo-50/50 border border-indigo-150 p-4 rounded-2xl text-indigo-950">
                <span className="font-extrabold text-indigo-900 block">{language === "bn" ? "১. পেমেন্ট প্রক্রিয়া" : "1. How Payments Work"}</span>
                <p>
                  {language === "bn"
                    ? "পেমেন্ট সফলভাবে যাচাই হলে প্রমোশন বা ক্রেডিট স্বয়ংক্রিয়ভাবে যুক্ত হয়। আপনার bKash পিন বা কার্ডের তথ্য আমরা দেখি না এবং রাখিও না।"
                    : "Once a payment is successfully verified, the promotion or credit is added automatically. We never see or store your bKash PIN or card details."}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "২. পেমেন্ট সংক্রান্ত সমস্যা" : "2. Payment Problems"}</span>
                <p>
                  {language === "bn"
                    ? "টাকা কেটে গেলেও প্রমোশন বা ক্রেডিট যুক্ত না হলে লেনদেনের আইডিসহ সাপোর্টে ইমেইল করুন। আমরা বিষয়টি যাচাই করে সমাধান করব।"
                    : "If money was deducted but your promotion or credit was not added, email support with your transaction ID. We will review the case and resolve it."}
                </p>
              </div>

              <div className="space-y-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                <span className="font-extrabold text-slate-900 block">{language === "bn" ? "৩. ক্রেতা-বিক্রেতার লেনদেন" : "3. Buyer-Seller Transactions"}</span>
                <p>
                  {language === "bn"
                    ? "পণ্য কেনাবেচার টাকা ক্রেতা ও বিক্রেতার মধ্যে সরাসরি লেনদেন হয়। গাড়ি বাজার সেই লেনদেনে অংশ নেয় না, তাই এর রিফান্ড আমাদের মাধ্যমে হয় না।"
                    : "Money for goods is exchanged directly between buyer and seller. Gari Bazar does not take part in that exchange, so refunds for it are not handled by us."}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 block">{language === "bn" ? "৪. কাস্টমার সাপোর্ট ও হেল্প ডেস্ক" : "4. Dispute Resolution Contacts"}</span>
                <p>
                  {language === "bn"
                    ? "যেকোনো অসঙ্গতি দূর করতে অথবা কোনো ফেক বিজ্ঞাপনের বিরুদ্ধে অভিযোগ জানাতে sadakalo7373@gmail.com ঠিকানায় ইমেইল পাঠান। ২৪ ঘণ্টার মধ্যে ব্যবস্থা গ্রহণ করা হবে।"
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
          {!standalone && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              {language === "bn" ? "আমি পড়েছি ও সম্মত" : "Done / I Agree"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
