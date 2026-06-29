/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from "react";
import { auth, db, storage } from "../firebase";
import { signInAnonymously } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { X, Phone, User, MapPin, Camera, Loader2, Sparkles, Gift, LogIn, Key } from "lucide-react";
import { CITIES } from "../translations";
import { SupportedLanguage } from "../types";
import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  onAuthSuccess: (user: any) => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1621360840013-c7683c659ec6?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=150&auto=format&fit=crop&q=80",
];

const compressImage = (file: File, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = objectUrl;
  });
};

const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [profilePic, setProfilePic] = useState("");
  const [referralInput, setReferralInput] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gari_bazar_prefilled_referral") || "";
    }
    return "";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 9 * 1024 * 1024) {
      setError(language === "bn" ? "ছবির সাইজ ৯ মেগাবাইটের কম হতে হবে" : "Image size must be under 9MB");
      return;
    }
    setCompressing(true);
    setError("");
    try {
      const compressedBase64 = await compressImage(file);
      setProfilePic(compressedBase64);
    } catch (err: any) {
      console.log("Failed to compress profile image, using original:", err);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => setProfilePic(reader.result as string);
      reader.onerror = () => setError(language === "bn" ? "ছবি প্রসেস করতে সমস্যা হয়েছে" : "Failed to process image");
    } finally {
      setCompressing(false);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms = 15000, fallbackName = "Operation"): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${fallbackName} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateBanglaPhone(phoneNumber)) {
      setError(
        language === "bn"
          ? "দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)"
          : "Please enter a valid 11-digit Bangladeshi mobile number"
      );
      return;
    }

    if (!isLogin && !displayName.trim()) {
      setError(language === "bn" ? "দয়া করে আপনার নাম লিখুন" : "Please enter your name");
      return;
    }

    setLoading(true);
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    try {
      let existingUid: string | null = null;
      let existingData: any = null;

      try {
        const usersCol = collection(db, "users");
        const q = query(usersCol, where("phoneNumber", "==", cleanPhone));
        const querySnap = await withTimeout(getDocs(q), 15000, "Firestore lookup");
        if (!querySnap.empty) {
          existingUid = querySnap.docs[0].id;
          existingData = querySnap.docs[0].data();
        }
      } catch (lookupErr) {
        console.warn("Failed to look up profile by phone:", lookupErr);
      }

      if (isLogin) {
        if (!existingUid || !existingData) {
          setError(
            language === "bn"
              ? "এই নম্বরে কোনো একাউন্ট পাওয়া যায়নি। অনুগ্রহ করে 'নতুন প্রোফাইল খুলুন' থেকে রেজিস্টার করুন।"
              : "No account found with this number. Please register using 'Create New Profile'."
          );
          setLoading(false);
          return;
        }

        try {
          await withTimeout(signInAnonymously(auth), 15000, "Anonymous auth");
        } catch (authErr) {
          console.warn("signInAnonymously failed during login:", authErr);
        }

        const sessionUser = {
          uid: existingUid,
          displayName: existingData.displayName,
          phoneNumber: existingData.phoneNumber,
          city: existingData.city,
          photoURL: existingData.profilePicture || existingData.photoURL || PRESET_AVATARS[0],
          simulatedCredits: existingData.simulatedCredits ?? 5000,
          createdAt: existingData.createdAt,
          referralCode: existingData.referralCode,
          referredBy: existingData.referredBy || null,
        };

        localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
        localStorage.setItem("gari_bazar_sellerName", sessionUser.displayName || "");
        localStorage.setItem("gari_bazar_contactNumber", sessionUser.phoneNumber || "");
        localStorage.setItem("gari_bazar_location", sessionUser.city || "");
        if (sessionUser.photoURL) localStorage.setItem("gari_bazar_sellerPhoto", sessionUser.photoURL);

        onAuthSuccess(sessionUser);
        onClose();
      } else {
        if (existingUid) {
          setError(
            language === "bn"
              ? "এই নম্বরে আপনার আগে থেকেই একাউন্ট আছে। দয়া করে 'লগইন করুন' এ গিয়ে লগইন করুন।"
              : "You already have an account with this number. Please use 'Login' instead."
          );
          setLoading(false);
          return;
        }

        let realUid = "user-" + cleanPhone;
        try {
          const userCredential = await withTimeout(signInAnonymously(auth), 15000, "Anonymous auth");
          realUid = userCredential.user.uid;
        } catch (authErr) {
          console.warn("signInAnonymously failed during register:", authErr);
        }

        let finalProfilePicUrl = profilePic || PRESET_AVATARS[0];
        if (profilePic && profilePic.startsWith("data:")) {
          try {
            const blob = dataURLtoBlob(profilePic);
            const uniqueName = `profile_${realUid}_${Date.now()}.jpg`;
            const storageRef = ref(storage, `profiles/${uniqueName}`);
            await withTimeout(uploadBytes(storageRef, blob), 15000, "Storage upload");
            finalProfilePicUrl = await withTimeout(getDownloadURL(storageRef), 15000, "Storage get URL");
          } catch (uploadErr) {
            console.error("Failed to upload profile picture:", uploadErr);
            finalProfilePicUrl = PRESET_AVATARS[0];
          }
        }

        const sanitizedDisplayName = sanitizeText(displayName || "Gari Bazar Seller", 50);
        const myReferralCode = `GB-${cleanPhone.slice(-4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const savedData: any = {
          uid: realUid,
          displayName: sanitizedDisplayName,
          email: `${cleanPhone}@garibazar.com`,
          phoneNumber: cleanPhone,
          city: sanitizeText(city, 50),
          profilePicture: finalProfilePicUrl,
          photoURL: finalProfilePicUrl,
          createdAt: new Date().toISOString(),
          simulatedCredits: 5000,
          referralCode: myReferralCode,
          referredBy: referralInput.trim() ? referralInput.trim().toUpperCase() : null,
        };

        if (referralInput.trim()) {
          try {
            const processedRefCode = referralInput.trim().toUpperCase();
            const usersCol = collection(db, "users");
            const q = query(usersCol, where("referralCode", "==", processedRefCode));
            const refSnap = await withTimeout(getDocs(q), 15000, "Referral check");
            if (!refSnap.empty) {
              const referrerDoc = refSnap.docs[0];
              const referrerData = referrerDoc.data();
              const referrerId = referrerDoc.id;
              if (referrerId !== realUid) {
                const oldCredits = referrerData.simulatedCredits ?? 5000;
                try {
                  await withTimeout(
                    updateDoc(doc(db, "users", referrerId), { simulatedCredits: oldCredits + 1500 }),
                    10000,
                    "Referrer credit update"
                  );
                } catch (updateCreditsErr) {
                  console.warn("Could not credit referrer:", updateCreditsErr);
                }
                savedData.simulatedCredits = 6500;
              }
            }
          } catch (refErr) {
            console.warn("Failed to find/credit referrer:", refErr);
          }
        }

        try {
          await withTimeout(setDoc(doc(db, "users", realUid), savedData), 15000, "New profile save");
        } catch (saveProfileErr) {
          console.warn("Could not save new user profile:", saveProfileErr);
        }

        localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
        localStorage.setItem("gari_bazar_sellerName", savedData.displayName);
        localStorage.setItem("gari_bazar_contactNumber", savedData.phoneNumber);
        localStorage.setItem("gari_bazar_location", savedData.city);
        localStorage.setItem("gari_bazar_sellerPhoto", savedData.profilePicture);

        onAuthSuccess(savedData);
        onClose();
      }
    } catch (err: any) {
      console.error("Login/Register failed:", err);
      setError(
        language === "bn" ? "কিছু একটা সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।" : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-600"></div>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-slate-200">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-5">
          <div className="text-center mb-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isLogin ? (language === "bn" ? "বিক্রেতা লগইন" : "Seller Login") : (language === "bn" ? "বিক্রেতা প্রোফাইল সেটআপ" : "Seller Profile Setup")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 max-w-xs mx-auto leading-relaxed">
              {isLogin
                ? (language === "bn" ? "আপনার পূর্বে ব্যবহৃত মোবাইল নম্বর দিয়ে অ্যাকাউন্টে লগইন করুন।" : "Log in using your previously registered mobile number.")
                : (language === "bn" ? "কোনো পাসওয়ার্ড বা জিমেইল ছাড়াই শুধু মোবাইল নাম্বার ও নাম দিয়ে অ্যাকাউন্ট খুলুন।" : "No passwords or Gmail required.")}
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-5">
            <button type="button" onClick={() => { setIsLogin(false); setError(""); }}
              className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${!isLogin ? "bg-white dark:bg-slate-900 text-amber-500 shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"}`}>
              {language === "bn" ? "নতুন প্রোফাইল খুলুন" : "Create Profile"}
            </button>
            <button type="button" onClick={() => { setIsLogin(true); setError(""); }}
              className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${isLogin ? "bg-white dark:bg-slate-900 text-amber-500 shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350"}`}>
              {language === "bn" ? "লগইন করুন" : "Login"}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">
                  {language === "bn" ? "১. বিক্রেতার প্রোফাইল ছবি" : "1. Seller Profile Photo"}
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl">
                  <div className="relative group cursor-pointer w-14 h-14 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0"
                    onClick={() => !compressing && fileInputRef.current?.click()}>
                    {compressing ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      </div>
                    ) : profilePic ? (
                      <>
                        <img src={profilePic} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                        <Camera className="w-4 h-4 mb-0.5 text-amber-500" />
                        <span className="text-[10px] font-black">{language === "bn" ? "যুক্ত" : "Add"}</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" disabled={compressing} />
                  <div className="flex-1 w-full text-center sm:text-left">
                    <button type="button" onClick={() => !compressing && fileInputRef.current?.click()}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-600">
                      {language === "bn" ? "ছবি যুক্ত করুন" : "Add Profile Photo"}
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {language === "bn" ? "বাস্তব ছবি ক্রেতাদের কাছে বিশ্বাস বাড়ায়।" : "Real photo increases trust among buyers"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">
                  {language === "bn" ? "২. বিক্রেতার নাম (Name) *" : "2. Seller Name *"}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><User className="w-4 h-4" /></span>
                  <input type="text" required={!isLogin} value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={language === "bn" ? "যেমন: তানভীর রাহমান" : "e.g. Tanvir Rahman"}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm" />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">
                {isLogin
                  ? (language === "bn" ? "আপনার নিবন্ধিত মোবাইল নম্বর *" : "Your Registered Mobile Number *")
                  : (language === "bn" ? "৩. মোবাইল ফোন নাম্বার *" : "3. Seller Contact Number *")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Phone className="w-4 h-4" /></span>
                <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 017XXXXXXXX"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg text-sm" />
              </div>
              <p className="text-[9px] text-slate-400 mt-1 leading-normal font-semibold">
                {language === "bn"
                  ? "ক্রেতারা পণ্য কিনতে সরাসরি এই নাম্বারে যোগাযোগ করবে এবং আপনার পোস্ট করা সব পণ্য এই নাম্বারে সংরক্ষিত থাকবে।"
                  : "Buyers will call you directly at this number."}
              </p>
            </div>

            {!isLogin && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wide">
                  {language === "bn" ? "৪. অবস্থান / জেলা *" : "4. District Location Address *"}
                </label>
          
