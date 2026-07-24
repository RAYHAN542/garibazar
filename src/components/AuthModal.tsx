import React, { useState, useRef } from "react";
import { auth, db, googleProvider, facebookProvider } from "../firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithCustomToken,
  getRedirectResult,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { X, MapPin, Loader2, Sparkles, Camera, Phone, ArrowLeft } from "lucide-react";
import { CITIES } from "../translations";
import { SupportedLanguage } from "../types";
import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";
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
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"start" | "phone" | "otp" | "profile">("start");
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePostGoogleAuth = async (fbUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", fbUser.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const existingData = userSnap.data() as any;
      const sessionUser = {
        uid: fbUser.uid,
        displayName: existingData.displayName,
        email: existingData.email || fbUser.email,
        phoneNumber: existingData.phoneNumber,
        city: existingData.city,
        profilePicture: existingData.profilePicture || fbUser.photoURL || PRESET_AVATARS[0],
        simulatedCredits: existingData.simulatedCredits ?? 5000,
        referralCode: existingData.referralCode,
      };
      localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
      trackEvent("login", fbUser.uid, sessionUser.email || sessionUser.phoneNumber);
      onAuthSuccess(sessionUser);
      onClose();
      return;
    }

    setGoogleUser(fbUser);
    setDisplayName(fbUser.displayName || "");
    setProfilePhotoPreview(fbUser.photoURL || null);
    setStep("profile");
  };

  React.useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await handlePostGoogleAuth(result.user);
        }
      } catch (err) {
        console.error("Redirect sign-in failed:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setStep("start");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(language === "bn" ? "শুধু ছবি ফাইল দিতে পারবেন" : "Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(language === "bn" ? "ছবির সাইজ ৫MB এর কম হতে হবে" : "Photo must be under 5MB");
      return;
    }

    setError("");
    setProfilePhotoFile(file);
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handlePostGoogleAuth(result.user);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // ইউজার নিজেই popup বন্ধ করেছে
      } else if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error(redirectErr);
          setError(language === "bn" ? "Google সাইন-ইন করা যায়নি।" : "Could not sign in with Google.");
        }
      } else {
        console.error(err);
        setError(language === "bn" ? "Google সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      await handlePostGoogleAuth(result.user);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // ইউজার নিজেই popup বন্ধ করেছে
      } else if (code === "auth/account-exists-with-different-credential") {
        setError(
          language === "bn"
            ? "এই ইমেইল দিয়ে আগে অন্য পদ্ধতিতে (যেমন Google) অ্যাকাউন্ট খোলা আছে। সেটা দিয়ে সাইন-ইন করুন।"
            : "An account already exists with this email using a different sign-in method. Please use that instead."
        );
      } else if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, facebookProvider);
          return;
        } catch (redirectErr) {
          console.error(redirectErr);
          setError(language === "bn" ? "Facebook সাইন-ইন করা যায়নি।" : "Could not sign in with Facebook.");
        }
      } else {
        console.error(err);
        setError(language === "bn" ? "Facebook সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Facebook sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanPhone = otpPhone.replace(/\D/g, "");
    if (!validateBanglaPhone(cleanPhone)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || (language === "bn" ? "OTP পাঠানো যায়নি।" : "Could not send OTP."));
        return;
      }
      setOtpCode("");
      setStep("otp");
    } catch (err) {
      console.error(err);
      setError(language === "bn" ? "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।" : "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otpCode)) {
      setError(language === "bn" ? "৬-সংখ্যার কোড দিন" : "Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone.replace(/\D/g, ""), code: otpCode }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || (language === "bn" ? "ভেরিফিকেশন ব্যর্থ হয়েছে।" : "Verification failed."));
        return;
      }
      const result = await signInWithCustomToken(auth, data.token);
      await handlePostGoogleAuth(result.user);
    } catch (err) {
      console.error(err);
      setError(language === "bn" ? "সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProfileStep = async () => {
    try { await signOut(auth); } catch { /* ignore */ }
    setGoogleUser(null);
    setStep("start");
    setError("");
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!googleUser) return;

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!validateBanglaPhone(cleanPhone)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }

    setLoading(true);
    try {
      const sanitizedDisplayName = sanitizeText(displayName || googleUser.displayName || "Gari Bazar Seller", 50);
      const myReferralCode = `GB-${cleanPhone.slice(-4)}`;

      let uploadedPhotoUrl = googleUser.photoURL || PRESET_AVATARS[0];
      if (profilePhotoFile) {
        setUploadingPhoto(true);
        try {
          const compressedBlob = await compressImageToBlob(profilePhotoFile);
          const uploadPromise = uploadToCloudinary(compressedBlob);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("upload/timeout")), 60000)
          );
          uploadedPhotoUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (photoErr: any) {
          console.error("Profile photo upload failed:", photoErr);
          setUploadingPhoto(false);
          setLoading(false);
          setError(
            photoErr?.message === "upload/timeout"
              ? (language === "bn" ? "ছবি আপলোড আটকে গেছে (Timeout)! আবার চেষ্টা করুন।" : "Photo upload timed out. Please try again.")
              : (language === "bn" ? "ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন অথবা ছবি ছাড়াই এগিয়ে যান।" : "Photo upload failed. Try again or continue without a photo.")
          );
          return;
        }
        setUploadingPhoto(false);
      }

      const savedData = {
        uid: googleUser.uid,
        displayName: sanitizedDisplayName,
        email: googleUser.email,
        phoneNumber: cleanPhone,
        city: sanitizeText(city, 50),
        profilePicture: uploadedPhotoUrl,
        createdAt: new Date().toISOString(),
        simulatedCredits: 5000,
        referralCode: myReferralCode,
      };

      await setDoc(doc(db, "users", googleUser.uid), savedData);
      localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
      trackEvent("signup", googleUser.uid, savedData.email || savedData.phoneNumber);
      onAuthSuccess(savedData);
      onClose();
    } catch (err) {
      console.error(err);
      setError(language === "bn" ? "কিছু একটা সমস্যা হয়েছে।" : "Something went wrong.");
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
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              {language === "bn"
                ? "গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য সাইন-ইন করুন।"
                : "Sign in to buy or sell on Gari Bazar."}
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-bold rounded-lg text-sm flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              {language === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
            </button>
            <button
              type="button"
              onClick={() => { setError(""); setStep("phone"); }}
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              {language === "bn" ? "মোবাইল নম্বর দিয়ে চালিয়ে যান" : "Continue with Phone"}
            </button>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              {language === "bn"
                ? "আপনার মোবাইল নম্বর দিন, আমরা একটা যাচাইকরণ কোড (OTP) পাঠাবো।"
                : "Enter your mobile number and we'll send a verification code (OTP)."}
            </p>
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
              <input
                type="tel"
                required
                autoFocus
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="01XXXXXXXXX"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {language === "bn" ? "কোড পাঠান" : "Send Code"}
            </button>
            <button type="button" onClick={() => { setError(""); setStep("start"); }} className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 hover:underline">
              <ArrowLeft className="w-3 h-3" />
              {language === "bn" ? "পেছনে যান" : "Back"}
            </button>
          </form>
        ) : step === "otp" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              {language === "bn"
                ? `${otpPhone} নম্বরে পাঠানো ৬-সংখ্যার কোডটি দিন।`
                : `Enter the 6-digit code sent to ${otpPhone}.`}
            </p>
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "OTP কোড *" : "OTP Code *"}</label>
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-3 py-2 text-center text-lg tracking-[0.5em] border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="······"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {language === "bn" ? "যাচাই করুন" : "Verify"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setError(""); setStep("phone"); }} className="flex items-center gap-1 text-slate-500 hover:underline">
                <ArrowLeft className="w-3 h-3" />
                {language === "bn" ? "নম্বর বদলান" : "Change number"}
              </button>
              <button type="button" onClick={handleSendOtp as any} disabled={loading} className="text-emerald-600 font-bold hover:underline disabled:opacity-60">
                {language === "bn" ? "আবার কোড পাঠান" : "Resend code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              {language === "bn"
                ? "শেষ ধাপ! ক্রেতারা যেন আপনার সাথে যোগাযোগ করতে পারে, তাই একটা মোবাইল নম্বর ও জেলা দিন।"
                : "Almost done! Add a phone number and district so buyers can contact you."}
            </p>

     
