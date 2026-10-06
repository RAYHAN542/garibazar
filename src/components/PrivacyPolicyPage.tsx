import React, { useState } from "react";
import { ShieldCheck, Calendar, Mail, ArrowLeft, Globe, Printer } from "lucide-react";
import { SupportedLanguage } from "../types";

interface PrivacyPolicyPageProps {
  language?: SupportedLanguage;
  onBack?: () => void;
  standalone?: boolean;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
    {children}
  </h2>
);

const InfoCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-slate-150 p-4 rounded-2xl bg-white space-y-1.5 shadow-sm">
    <span className="font-extrabold text-xs text-indigo-600 uppercase tracking-wider block">{title}</span>
    <p className="text-xs">{children}</p>
  </div>
);

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
                {lang === "bn" ? "সর্বশেষ আপডেট: ৭ অক্টোবর, ২০২৬" : "Last Updated: October 7, 2026"}
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
        <div className="p-6 sm:p-10 space-y-8 font-sans leading-relaxed text-sm text-slate-600">

          {lang === "bn" ? (
            /* BENGALI PRIVACY POLICY */
            <>
              <section className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3">
                <SectionTitle>গোপনীয়তা চুক্তি ও ভূমিকা</SectionTitle>
                <p>
                  <strong>গাড়ি বাজার (Gari Bazar)</strong> গাড়ি, বাইক, ভারী যন্ত্রপাতি ও তাদের পার্টস কেনাবেচার একটি অনলাইন মার্কেটপ্লেস।
                  এটি ওয়েবসাইট (garibazar.shop) এবং অ্যান্ড্রয়েড অ্যাপ, এই দুই মাধ্যমেই পাওয়া যায়। ডেভেলপার <strong>MD RAYHAN</strong> আপনার তথ্যের সুরক্ষায় প্রতিশ্রুতিবদ্ধ।
                  এই নীতিতে বলা হয়েছে আমরা কোন তথ্য সংগ্রহ করি, কেন করি, কাদের সাথে শেয়ার করি এবং আপনি কীভাবে তা মুছে ফেলতে পারেন।
                </p>
              </section>

              <section className="space-y-4">
                <SectionTitle>১. আমরা কী কী তথ্য সংগ্রহ করি এবং কেন?</SectionTitle>
                <p>
                  সেবা চালু রাখতে এবং ক্রেতা-বিক্রেতার মধ্যে আস্থা নিশ্চিত করতে আমরা প্রধানত নিচের তথ্যগুলো সংগ্রহ করি:
                </p>

                <div className="space-y-4 pt-2">
                  <InfoCard title="ক) নাম ও মোবাইল নম্বর">
                    <strong>উদ্দেশ্য:</strong> আপনি মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খোলেন ও লগইন করেন, সাথে আপনার নাম দেন।
                    এটি অ্যাকাউন্ট পরিচালনা, ভুয়া বা একাধিক অ্যাকাউন্ট ঠেকানো এবং ক্রেতা-বিক্রেতার সরাসরি যোগাযোগের জন্য ব্যবহৃত হয়।
                    বিক্রেতার ফোন নম্বর আগ্রহী ক্রেতাদের দেখানো হয়। পাসওয়ার্ড আমরা সরাসরি দেখি না, এটি Supabase Authentication-এর মাধ্যমে নিরাপদভাবে হ্যাশ করে রাখা হয়।
                  </InfoCard>

                  <InfoCard title="খ) ইমেইল ঠিকানা (ঐচ্ছিক)">
                    <strong>উদ্দেশ্য:</strong> ইমেইল দিলে তা শুধু অ্যাকাউন্ট ব্যবস্থাপনা ও প্রয়োজনে যোগাযোগের জন্য ব্যবহৃত হয়।
                  </InfoCard>

                  <InfoCard title="গ) অবস্থান (শহর/জেলা)">
                    <strong>উদ্দেশ্য:</strong> আপনি নিজে যে শহর বা এলাকা উল্লেখ করেন (বা লিস্টিংয়ের বর্ণনা থেকে শনাক্ত হয়) তা সংরক্ষণ করা হয়, যাতে কাছাকাছি ক্রেতা ও বিক্রেতা খুঁজে পাওয়া যায়।
                    অ্যাপ আপনার ফোনের GPS বা সঠিক (precise) লোকেশন সংগ্রহ করে না।
                  </InfoCard>

                  <InfoCard title="ঘ) ছবি">
                    <strong>উদ্দেশ্য:</strong> লিস্টিংয়ের জন্য পণ্যের ছবি এবং প্রোফাইল ছবি (যদি দেন) আপলোড করা হয়। ছবিগুলো Cloudinary-তে হোস্ট করা হয়।
                    লিস্টিংয়ের ছবি অন্যান্য ব্যবহারকারীদের দেখানো হয়।
                  </InfoCard>

                  <InfoCard title="ঙ) লিস্টিং, চ্যাট মেসেজ ও রিপোর্ট">
                    <strong>উদ্দেশ্য:</strong> আপনার পোস্ট করা লিস্টিং (দাম, বর্ণনা), ক্রেতা-বিক্রেতার মধ্যে চ্যাট মেসেজ এবং রিপোর্ট বা ব্লকের তথ্য সংরক্ষণ করা হয়।
                    এগুলো চ্যাট সেবা দেওয়া, প্ল্যাটফর্মের নিরাপত্তা ও অপব্যবহার ঠেকানোর জন্য ব্যবহৃত হয়।
                  </InfoCard>

                  <InfoCard title="চ) ডিভাইস আইডি ও ব্যবহারের তথ্য">
                    <strong>উদ্দেশ্য:</strong> স্প্যাম ও বট ঠেকাতে এবং সাইট বা অ্যাপ কীভাবে ব্যবহৃত হচ্ছে (ভিজিট, লগইন, সাইন-আপ, ইনস্টল, লিস্টিং দেখা বা সেভ করা) তা বুঝতে
                    একটি ডিভাইস বা ইনস্টলেশন আইডি এবং ব্যবহারের ঘটনা সংগ্রহ করা হয়।
                  </InfoCard>

                  <InfoCard title="ছ) লেনদেনের তথ্য (শুধু ওয়েবসাইটে)">
                    <strong>উদ্দেশ্য:</strong> ওয়েবসাইটে বিজ্ঞাপন প্রচারের পেমেন্ট UddoktaPay ও bKash-এর মাধ্যমে হয়।
                    আমরা কেবল পরিমাণ, পেমেন্টের অবস্থা ও লেনদেন রেফারেন্স রাখি। আপনার bKash পিন বা কার্ডের তথ্য আমরা পাই না এবং রাখিও না।
                  </InfoCard>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>২. তথ্যের ব্যবহার ও শেয়ারিং</SectionTitle>
                <ul className="list-disc pl-5 space-y-1.5 text-xs">
                  <li>অ্যাকাউন্ট, লিস্টিং, চ্যাট ও সাপোর্ট সেবা দিতে আপনার তথ্য ব্যবহার করা হয়।</li>
                  <li>জাল লিস্টিং, স্প্যাম অ্যাকাউন্ট ও অপব্যবহার ঠেকাতে তথ্য ব্যবহার করা হয়।</li>
                  <li><strong>আমরা আপনার ব্যক্তিগত তথ্য বিক্রি করি না।</strong></li>
                  <li>
                    আমাদের হয়ে তথ্য প্রক্রিয়াকরণকারী সেবাদাতা: Supabase (অ্যাকাউন্ট, লিস্টিং, চ্যাট, ব্যবহারের পরিসংখ্যান), Google Firebase (শুধু পুশ নোটিফিকেশন, FCM),
                    Cloudinary (ছবি), Vercel (হোস্টিং ও সার্ভার), UddoktaPay ও bKash (ওয়েবসাইটের পেমেন্ট)।
                  </li>
                  <li>
                    ওয়েবসাইটে Google AdSense ও Adsterra-র মতো তৃতীয় পক্ষের বিজ্ঞাপন দেখানো হতে পারে। তারা নিজেদের নীতি অনুযায়ী কুকি বা ডিভাইস শনাক্তকারী ব্যবহার করতে পারে।
                    অ্যান্ড্রয়েড অ্যাপে Google AdMob-এর মাধ্যমে বিজ্ঞাপন দেখানো হয়। Google বিজ্ঞাপন দেখাতে ও তার কার্যকারিতা মাপতে আপনার ডিভাইসের বিজ্ঞাপন আইডি (Advertising ID) ও অনুরূপ শনাক্তকারী ব্যবহার করতে পারে। ফোনের Settings → Google → Ads থেকে বিজ্ঞাপন আইডি মুছতে বা বিজ্ঞাপন-ব্যক্তিগতকরণ বন্ধ করতে পারেন। Google কীভাবে তথ্য ব্যবহার করে তা জানতে: policies.google.com/technologies/partner-sites
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <SectionTitle>৩. ডেটা স্টোরেজ ও নিরাপত্তা</SectionTitle>
                <p>
                  আপনার অ্যাকাউন্ট, লিস্টিং, চ্যাট ও ব্যবহারের পরিসংখ্যান <strong>Supabase</strong>-এ এবং ছবি <strong>Cloudinary</strong>-তে সংরক্ষিত হয়। পুশ নোটিফিকেশন পাঠাতে অ্যাপের ডিভাইস টোকেন <strong>Google Firebase Cloud Messaging (FCM)</strong> ব্যবহার করে।
                  সব যোগাযোগ HTTPS/SSL এনক্রিপশনের মাধ্যমে হয় এবং অননুমোদিত প্রবেশ ঠেকাতে ডেটাবেসে অ্যাক্সেস নিয়ন্ত্রণ (security rules) প্রয়োগ করা আছে।
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>৪. তথ্য সংরক্ষণকাল ও অ্যাকাউন্ট মুছে ফেলার অধিকার</SectionTitle>
                <p>
                  আপনার তথ্য অ্যাকাউন্ট ডিলিট না করা পর্যন্ত সংরক্ষিত থাকে। আপনি যেকোনো সময় অ্যাপের ড্যাশবোর্ড থেকে অ্যাকাউন্ট ডিলিট করতে পারেন, অথবা
                  {" "}<a href="https://garibazar.shop/delete-account" className="text-indigo-600 hover:underline">https://garibazar.shop/delete-account</a>{" "}
                  পেজে গিয়ে অ্যাকাউন্ট ও সংশ্লিষ্ট ডেটা মুছে ফেলার অনুরোধ করতে পারেন।
                  ইমেইলেও অনুরোধ পাঠানো যায়। অনুরোধ পাওয়ার ২৪-৪৮ ঘণ্টার মধ্যে আপনার অ্যাকাউন্ট ও সংশ্লিষ্ট রেকর্ড স্থায়ীভাবে মুছে ফেলা হয়।
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>৫. শিশুদের গোপনীয়তা</SectionTitle>
                <p>
                  এই সেবা ১৮ বছরের কম বয়সীদের জন্য নয়। আমরা জেনেশুনে অপ্রাপ্তবয়স্কদের কোনো ব্যক্তিগত তথ্য সংগ্রহ করি না।
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>৬. নীতির পরিবর্তন ও যোগাযোগ</SectionTitle>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs">
                    এই নীতিতে কোনো পরিবর্তন হলে এই পেজে সর্বশেষ আপডেটের তারিখসহ প্রকাশ করা হবে। প্রাইভেসি সংক্রান্ত কোনো প্রশ্ন বা অভিযোগ থাকলে নিচের ঠিকানায় ইমেইল করুন:
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
                <SectionTitle>Agreement & Scope</SectionTitle>
                <p>
                  <strong>Gari Bazar</strong> is an online marketplace for buying and selling cars, bikes, heavy equipment and their parts.
                  It is available on the website (garibazar.shop) and as an Android app. The developer, <strong>MD RAYHAN</strong>, is committed to protecting your information.
                  This policy explains what we collect, why we collect it, who we share it with, and how you can delete it.
                </p>
              </section>

              <section className="space-y-4">
                <SectionTitle>1. Information We Collect and Why</SectionTitle>
                <p>
                  To run the service and build trust between buyers and sellers, we mainly collect the following:
                </p>

                <div className="space-y-4 pt-2">
                  <InfoCard title="A) Name and Phone Number">
                    <strong>Purpose:</strong> You create an account and sign in with your phone number and a password, and you provide your name.
                    This is used to manage your account, prevent fake or duplicate accounts, and let buyers and sellers contact each other directly.
                    A seller's phone number is shown to interested buyers. We never see your password in plain text; it is securely hashed by Supabase Authentication.
                  </InfoCard>

                  <InfoCard title="B) Email Address (optional)">
                    <strong>Purpose:</strong> If you provide an email, it is used only for account management and, when needed, to contact you.
                  </InfoCard>

                  <InfoCard title="C) Location (city / district)">
                    <strong>Purpose:</strong> We store the city or area you state yourself (or that is identified from your listing description) so nearby buyers and sellers can find each other.
                    The app does not collect your phone's GPS or precise location.
                  </InfoCard>

                  <InfoCard title="D) Photos">
                    <strong>Purpose:</strong> Product photos for listings and a profile photo (if you add one) are uploaded and hosted on Cloudinary.
                    Listing photos are shown to other users.
                  </InfoCard>

                  <InfoCard title="E) Listings, Chat Messages and Reports">
                    <strong>Purpose:</strong> We store the listings you post (price, description), chat messages between buyers and sellers, and report or block information.
                    This is used to provide chat, keep the platform safe and prevent abuse.
                  </InfoCard>

                  <InfoCard title="F) Device ID and Usage Data">
                    <strong>Purpose:</strong> To prevent spam and bots and to understand how the site or app is used (visits, logins, sign-ups, installs, listing views and saves),
                    we collect a device or installation ID and usage events.
                  </InfoCard>

                  <InfoCard title="G) Transaction Data (website only)">
                    <strong>Purpose:</strong> Payments for ad promotion on the website are processed by UddoktaPay and bKash.
                    We keep only the amount, payment status and transaction reference. We do not receive or store your bKash PIN or card details.
                  </InfoCard>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>2. Use and Sharing of Information</SectionTitle>
                <ul className="list-disc pl-5 space-y-1.5 text-xs">
                  <li>We use your information to provide accounts, listings, chat and support.</li>
                  <li>We use it to prevent counterfeit listings, spam accounts and abuse.</li>
                  <li><strong>We do not sell your personal information.</strong></li>
                  <li>
                    Service providers that process data on our behalf: Supabase (accounts, listings, chat, usage statistics), Google Firebase (push notifications only, FCM),
                    Cloudinary (images), Vercel (hosting and servers), and UddoktaPay and bKash (website payments).
                  </li>
                  <li>
                    The website may show third-party ads such as Google AdSense and Adsterra, which may use cookies or device identifiers under their own policies.
                    The Android app shows ads through Google AdMob. Google may use your device's Advertising ID and similar identifiers to show ads and measure their performance. You can reset your advertising ID or turn off ad personalization in your phone's Settings → Google → Ads. To learn how Google uses data, see policies.google.com/technologies/partner-sites
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <SectionTitle>3. Data Storage and Security</SectionTitle>
                <p>
                  Your account, listings, chat and usage statistics are stored in <strong>Supabase</strong> and images on <strong>Cloudinary</strong>. The app's device token is used with <strong>Google Firebase Cloud Messaging (FCM)</strong> to deliver push notifications.
                  All communication uses HTTPS/SSL encryption, and access rules (security rules) are applied to the databases to prevent unauthorized access.
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>4. Retention and Your Right to Delete</SectionTitle>
                <p>
                  Your data is kept until you delete your account. You can delete your account at any time from the dashboard in the app, or request deletion of your account and related data at{" "}
                  <a href="https://garibazar.shop/delete-account" className="text-indigo-600 hover:underline">https://garibazar.shop/delete-account</a>.
                  You can also email us. Your account and related records are permanently deleted within 24-48 hours of the request.
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>5. Children's Privacy</SectionTitle>
                <p>
                  This service is not intended for people under 18. We do not knowingly collect personal information from minors.
                </p>
              </section>

              <section className="space-y-3">
                <SectionTitle>6. Changes to This Policy and Contact</SectionTitle>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs">
                    If this policy changes, the updated version will be published on this page with a new "Last Updated" date. For any privacy questions or complaints, write to:
                  </p>
                  <ul className="text-xs space-y-1 font-bold text-slate-800">
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
