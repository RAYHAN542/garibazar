import React, { useState, useRef } from "react";
import { X, MapPin, Loader2, Sparkles, Camera, Phone, ArrowLeft } from "lucide-react";
import { CITIES } from "../translations";
import { SupportedLanguage } from "../types";
import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";
import { apiUrl } from "../utils/apiBase";
import { supabase } from "../supabase";


import { uploadToCloudinary } from "../utils/cloudinary";
import { trackEvent } from "../utils/trackEvent";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: SupportedLanguage;
  onAuthSuccess: (user: any) => void;
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
];

const compressImageToBlob = async (file: File, maxWidth = 512, maxHeight = 512): Promise<Blob> => {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image for compression"));
      };
      image.src = objectUrl;
    });

  let { width, height } = img;
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
  } else if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context is null");
  ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) reject(new Error("Failed to convert canvas to Blob"));
        else resolve(b);
      }, "image/jpeg", 0.8);
    });
  } catch (err) {
    // Some Android browsers cannot decode iPhone HEIC/HEIF. Cloudinary can
    // receive the original file, so don't block signup just because local
    // browser compression is unavailable.
    console.warn("Image compression skipped; uploading original file.", err);
    return file;
  }
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"start" | "phone" | "profile">("start");
  const [otpPhone, setOtpPhone] = useState("");
  // phoneAuthMode: OTP/SMS gateway সরিয়ে ফোন নম্বর + পাসওয়ার্ড দিয়ে লগইন/সাইনআপ করা হয়,
  // কারণ SMS gateway (Android ফোন-ভিত্তিক) মাঝেমধ্যে অফলাইন/ব্যর্থ হয়ে যায়।
  const [phoneAuthMode, setPhoneAuthMode] = useState<"login" | "signup">("login");
  const [phonePassword, setPhonePassword] = useState("");
  const [phonePasswordConfirm, setPhonePasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const authInProgressRef = useRef(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetLoading = (val: boolean) => {
    if (isMountedRef.current) setLoading(val);
  };
  const safeSetError = (val: string) => {
    if (isMountedRef.current) setError(val);
  };

  // popup/redirect উভয় auth flow-এর জন্য একই bilingual error mapping ব্যবহার করা হয়,
  // যাতে কোথাও কোনো error code মিস না হয়ে যায়। null রিটার্ন করলে সেটা silently
  // ignore করা উচিত (যেমন: ইউজার নিজেই popup বন্ধ করেছে)।
  const handlePostPhoneAuth = async (uid: string, phone: string) => {
    const { data: userRow } = await supabase.from("users").select("*").eq("uid", uid).maybeSingle();
    const { data: adminRow } = await supabase.from("admins").select("uid").eq("uid", uid).maybeSingle();

    const sessionUser = {
      uid,
      displayName: userRow?.name,
      email: userRow?.email,
      phoneNumber: userRow?.phone || phone,
      city: userRow?.city,
      profilePicture: userRow?.profile_picture || PRESET_AVATARS[0],
      simulatedCredits: userRow?.simulated_credits ?? 5000,
      referralCode: userRow?.referral_code,
      isAdmin: !!adminRow,
    };
    localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
    trackEvent("login", uid, sessionUser.phoneNumber);
    onAuthSuccess(sessionUser);
    onClose();
  };


  React.useEffect(() => {
    if (!isOpen) {
      setStep("start");
      setError("");
      setPhoneAuthMode("login");
      setPhonePassword("");
      setPhonePasswordConfirm("");
      setDisplayName("");
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isHeic = fileName.endsWith(".heic") || fileName.endsWith(".heif") ||
      file.type === "image/heic" || file.type === "image/heif";

    if (!file.type.startsWith("image/") && !isHeic) {
      setError(language === "bn" ? "শুধু ছবি ফাইল দিতে পারবেন" : "Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(language === "bn" ? "ছবির সাইজ ১০MB এর কম হতে হবে" : "Photo must be under 10MB");
      return;
    }

    setError("");
    setProfilePhotoFile(file);
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanPhone = otpPhone.replace(/\D/g, "");
    if (!validateBanglaPhone(cleanPhone)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }
    if (!phonePassword) {
      setError(language === "bn" ? "পাসওয়ার্ড দিন" : "Enter your password");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/api/auth/phone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", phone: cleanPhone, password: phonePassword }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.code === "NOT_REGISTERED") {
          setPhoneAuthMode("signup");
        }
        setError(data.error || (language === "bn" ? "লগইন ব্যর্থ হয়েছে।" : "Login failed."));
        return;
      }
      await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      await handlePostPhoneAuth(data.uid, data.phone);
    } catch (err: any) {
      console.error(err);
      const debugMsg = err?.message || String(err) || "unknown";
      setError(
        (language === "bn" ? "সাইন-ইন ব্যর্থ হয়েছে। " : "Sign-in failed. ") + `[DEBUG: ${debugMsg}]`
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = otpPhone.replace(/\D/g, "");
    const cleanName = sanitizeText(displayName.trim(), 50);

    if (!profilePhotoFile) {
      setError(language === "bn" ? "প্রথমে একটি প্রোফাইল ছবি দিন" : "Please add a profile photo first");
      return;
    }
    if (!cleanName) {
      setError(language === "bn" ? "আপনার নাম দিন" : "Enter your name");
      return;
    }
    if (!validateBanglaPhone(cleanPhone)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }
    if (phonePassword.length < 8) {
      setError(language === "bn" ? "পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে" : "Password must be at least 8 characters");
      return;
    }
    if (phonePassword !== phonePasswordConfirm) {
      setError(language === "bn" ? "দুই পাসওয়ার্ড মিলছে না" : "Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(apiUrl("/api/auth/phone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", phone: cleanPhone, password: phonePassword }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        if (data.code === "ALREADY_REGISTERED") setPhoneAuthMode("login");
        setError(data.error || (language === "bn" ? "অ্যাকাউন্ট তৈরি করা যায়নি।" : "Could not create account."));
        return;
      }

      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      setUploadingPhoto(true);
      let profilePicture: string;
      try {
        const compressedBlob = await compressImageToBlob(profilePhotoFile);
        const uploadPromise = uploadToCloudinary(compressedBlob);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("upload/timeout")), 60000)
        );
        profilePicture = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (photoErr: any) {
        console.error("Signup profile photo upload failed:", photoErr);
        setError(
          photoErr?.message === "upload/timeout"
            ? (language === "bn" ? "ছবি আপলোড আটকে গেছে। আবার চেষ্টা করুন।" : "Photo upload timed out. Please try again.")
            : (language === "bn" ? "ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Photo upload failed. Please try again.")
        );
        return;
      } finally {
        setUploadingPhoto(false);
      }

      // 🔧 (2026-09-27) আগে এখানে created_at: new Date().toISOString() পাঠানো
      // হতো এই upsert-এর সাথে। কিন্তু এই uid-এর রো ততক্ষণে ইতিমধ্যেই তৈরি
      // হয়ে গেছে (handle_new_auth_user() ট্রিগার সাইনআপের সাথে সাথেই নিজের
      // created_at দিয়ে insert করে দেয়) -- তাই এই upsert একটা UPDATE হিসেবে
      // চলে, এবং created_at-এর নতুন মান পুরনো মানের থেকে ভিন্ন হওয়ায়
      // trg_protect_user_columns ট্রিগার সেটাকে protected ফিল্ড পরিবর্তন
      // ধরে পুরো আপডেটটাই ব্লক করে দিচ্ছিল ("Not allowed to change
      // protected user fields directly") -- ফলে অ্যাকাউন্ট তৈরি হয়ে গেলেও
      // নাম/ছবি কখনো সেভ হচ্ছিল না। created_at বাদ দেওয়া হলো -- ট্রিগার
      // insert-এর সময়ই এটা সঠিকভাবে সেট করে রাখে।
      const { error: profileError } = await supabase.from("users").upsert({
        uid: data.uid,
        name: cleanName,
        phone: data.phone,
        profile_picture: profilePicture,
      }, { onConflict: "uid" });

      if (profileError) {
        console.error("Signup profile save failed:", profileError);
        setError(
          language === "bn"
            ? "অ্যাকাউন্ট হয়েছে, কিন্তু প্রোফাইল সেভ হয়নি। আবার চেষ্টা করুন।"
            : "Account created, but profile could not be saved. Please try again."
        );
        return;
      }

      await handlePostPhoneAuth(data.uid, data.phone);
    } catch (err: any) {
      console.error(err);
      setError(
        (language === "bn" ? "সাইন-ইন ব্যর্থ হয়েছে। " : "Sign-in failed. ") +
        `[DEBUG: ${err?.message || String(err) || "unknown"}]`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {step === "profile"
              ? (language === "bn" ? "প্রোফাইল সম্পূর্ণ করুন" : "Complete Your Profile")
              : (language === "bn" ? "স্বাগতম" : "Welcome")}
          </h2>
        </div>

        {error && <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs mb-3 text-center">{error}</div>}

        {step === "start" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">
              {language === "bn"
                ? "গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য সাইন-ইন করুন।"
                : "Sign in to buy or sell on Gari Bazar."}
            </p>
            <button
              type="button"
              onClick={() => { setError(""); setStep("phone"); }}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                <Phone className="w-4 h-4 text-slate-900" />
              </span>
              {language === "bn" ? "মোবাইল নম্বর দিয়ে চালিয়ে যান" : "Continue with Phone"}
            </button>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={phoneAuthMode === "login" ? handlePhoneLogin : handlePhoneSignup} className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              {phoneAuthMode === "login"
                ? (language === "bn" ? "আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন।" : "Sign in with your mobile number and password.")
                : (language === "bn" ? "নতুন অ্যাকাউন্ট তৈরি করুন।" : "Create your new account.")}
            </p>

            {phoneAuthMode === "signup" && (
              <>
                {/* 1. Profile image */}
                <div className="flex justify-center">
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                    {profilePhotoPreview ? (
                      <>
                        <img src={profilePhotoPreview} alt="preview" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-slate-900/60 text-white flex items-center justify-center py-1">
                          <Camera className="w-3.5 h-3.5" />
                        </span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-slate-400" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-bold text-center py-0.5">
                          {language === "bn" ? "ছবি দিন" : "Add Photo"}
                        </div>
                      </>
                    )}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoSelect} accept="image/*" className="hidden" />
                </div>

                {/* 2. Name */}
                <div>
                  <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "আপনার নাম *" : "Name *"}</label>
                  <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder={language === "bn" ? "আপনার নাম লিখুন" : "Your name"} />
                </div>
              </>
            )}

            {/* 3. Number */}
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
              <input type="tel" required value={otpPhone} onChange={(e) => setOtpPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="01XXXXXXXXX" />
            </div>

            {/* 4. Password */}
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "পাসওয়ার্ড *" : "Password *"}</label>
              <input type="password" required value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder={language === "bn" ? "কমপক্ষে ৮ ক্যারেক্টার" : "At least 8 characters"} />
            </div>

            {/* 5. Confirm password */}
            {phoneAuthMode === "signup" && (
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "পাসওয়ার্ড আবার দিন *" : "Confirm Password *"}</label>
                <input type="password" required value={phonePasswordConfirm} onChange={(e) => setPhonePasswordConfirm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder={language === "bn" ? "পাসওয়ার্ড আবার লিখুন" : "Re-enter password"} />
              </div>
            )}

            <button type="submit" disabled={loading || uploadingPhoto}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading || uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {uploadingPhoto
                ? (language === "bn" ? "ছবি আপলোড হচ্ছে..." : "Uploading photo...")
                : phoneAuthMode === "login"
                  ? (language === "bn" ? "সাইন-ইন করুন" : "Sign In")
                  : (language === "bn" ? "অ্যাকাউন্ট তৈরি করুন" : "Create Account")}
            </button>

            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <button type="button" onClick={() => { setError(""); setStep("start"); }} className="flex items-center gap-1 text-slate-500 hover:underline shrink-0">
                <ArrowLeft className="w-3 h-3" /> {language === "bn" ? "পেছনে যান" : "Back"}
              </button>
              <button type="button"
                onClick={() => { setError(""); setPhoneAuthMode(phoneAuthMode === "login" ? "signup" : "login"); }}
                className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline text-right">
                {phoneAuthMode === "login"
                  ? (language === "bn" ? "নতুন অ্যাকাউন্ট তৈরি করুন" : "Create new account")
                  : (language === "bn" ? "আগে থেকে অ্যাকাউন্ট আছে? সাইন-ইন" : "Already have an account? Sign in")}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
