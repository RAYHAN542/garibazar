import React, { useState } from "react";
import { Car, Mail, ArrowLeft, Globe, MapPin, ShieldCheck } from "lucide-react";
import { SupportedLanguage } from "../types";

interface AboutContactPageProps {
  language?: SupportedLanguage;
  onBack?: () => void;
  standalone?: boolean;
}

export default function AboutContactPage({
  language: initialLanguage = "bn",
  onBack,
  standalone = false,
}: AboutContactPageProps) {
  const [lang, setLang] = useState<SupportedLanguage>(initialLanguage);

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
                <Car className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  {lang === "bn" ? "আমাদের সম্পর্কে" : "About Us"}
                </h1>
                <p className="text-slate-300 text-sm mt-1">
                  {lang === "bn" ? "গাড়ি বাজার (Gari Bazar)" : "Gari Bazar"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-10 space-y-8 text-sm leading-relaxed text-slate-700">

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              {lang === "bn" ? "গাড়ি বাজার কী?" : "What is Gari Bazar?"}
            </h2>
            <p>
              {lang === "bn"
                ? "গাড়ি বাজার হলো বাংলাদেশের একটি অনলাইন মার্কেটপ্লেস, যেখানে ব্যবহারকারীরা গাড়ি, বাইক ও তার স্পেয়ার পার্টস সহজে খুঁজে পেতে ও কেনাবেচা করতে পারেন। আমাদের লক্ষ্য হলো ক্রেতা ও বিক্রেতার মধ্যে একটি নিরাপদ ও সহজ যোগাযোগ মাধ্যম তৈরি করা।"
                : "Gari Bazar is an online marketplace in Bangladesh where users can easily find, buy, and sell vehicles, motorcycles, and auto spare parts. Our goal is to create a safe and simple bridge between buyers and sellers across the country."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              {lang === "bn" ? "আমাদের মিশন" : "Our Mission"}
            </h2>
            <p>
              {lang === "bn"
                ? "আমরা বিশ্বাস করি গাড়ি ও পার্টস কেনাবেচা আরও স্বচ্ছ এবং ঝামেলামুক্ত হওয়া উচিত। এই প্ল্যাটফর্মের মাধ্যমে আমরা স্থানীয় বিক্রেতাদের একটি বৃহত্তর ডিজিটাল বাজারে সংযুক্ত করছি, যাতে ক্রেতারা সহজে সঠিক দামে সঠিক পণ্য খুঁজে পান।"
                : "We believe that buying and selling vehicles and parts should be transparent and hassle-free. Through this platform, we connect local sellers to a wider digital marketplace, helping buyers find the right product at the right price."}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              {lang === "bn" ? "যোগাযোগ করুন" : "Contact Us"}
            </h2>
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {lang === "bn" ? "সাপোর্ট ইমেইল" : "Support Email"}
                  </span>
                  <a href="mailto:sadakalo7373@gmail.com" className="text-indigo-600 hover:underline">
                    sadakalo7373@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">
                    {lang === "bn" ? "সেবা অঞ্চল" : "Service Area"}
                  </span>
                  <span>{lang === "bn" ? "বাংলাদেশ" : "Bangladesh"}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {lang === "bn"
                ? "যেকোনো প্রশ্ন, অভিযোগ বা পার্টনারশিপ প্রস্তাবের জন্য উপরের ইমেইলে যোগাযোগ করুন। আমরা সাধারণত ২৪-৪৮ ঘণ্টার মধ্যে উত্তর দিয়ে থাকি।"
                : "For any questions, complaints, or partnership inquiries, please reach out via the email above. We typically respond within 24-48 hours."}
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
