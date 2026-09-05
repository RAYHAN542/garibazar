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
import { apiUrl } from "../utils/apiBase";
import { supabase } from "../supabase";

const isInAppBrowser = typeof navigator !== "undefined" && /FBAN|FBAV|Instagram|Messenger/i.test(navigator.userAgent);
const SOCIAL_LOGIN_ENABLED = false;

const openInChrome = () => {
  const targetUrl = window.location.href;
  const intentUrl = `intent://${targetUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
  window.location.href = intentUrl;
};
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

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"start" | "phone" | "profile">("start");
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
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
  const getAuthErrorMessage = (err: any, provider: "google" | "facebook"): string | null => {
    const providerName = provider === "google" ? "Google" : "Facebook";
    if (err?.message === "popup-timeout") {
      return language === "bn"
        ? "সাইন-ইন সাড়া দিচ্ছে না। এই ব্রাউজারের Privacy/Tracking Protection সেটিংস ব্লক করছে হয়তো — Chrome ব্রাউজার দিয়ে চেষ্টা করুন, অথবা এই সাইটের জন্য Tracking Protection বন্ধ করুন।"
        : "Sign-in isn't responding. This browser's Privacy/Tracking Protection may be blocking sign-in — try Chrome, or turn off Tracking Protection for this site.";
    }
    const code = err?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return null; // ইউজার নিজেই popup বন্ধ করেছে, এটা error না
    }
    if (code === "auth/unauthorized-domain") {
      return language === "bn"
        ? "এই ওয়েবসাইট ডোমেইনটি Firebase-এ অনুমোদিত না। এটা এডমিনকে জানাতে হবে (Firebase Console -> Authentication -> Settings -> Authorized domains)।"
        : "This website's domain isn't authorized for sign-in yet. Please report this — it needs to be added in Firebase Console -> Authentication -> Settings -> Authorized domains.";
    }
    if (code === "auth/account-exists-with-different-credential") {
      return language === "bn"
        ? "এই ইমেইল দিয়ে আগে অন্য পদ্ধতিতে (Google/Facebook) অ্যাকাউন্ট খোলা আছে। সেটা দিয়ে সাইন-ইন করুন।"
        : "An account already exists with this email using a different sign-in method. Please use that instead.";
    }
    if (code === "auth/network-request-failed") {
      return language === "bn"
        ? "ইন্টারনেট সংযোগে সমস্যা হচ্ছে। নেটওয়ার্ক চেক করে আবার চেষ্টা করুন।"
        : "Network problem. Please check your connection and try again.";
    }
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      return language === "bn"
        ? "আপনার ব্রাউজার পপ-আপ ব্লক করেছে। ব্রাউজারের ঠিকানা বারে পপ-আপ আইকনে ট্যাপ করে অনুমতি দিন, তারপর আবার চেষ্টা করুন।"
        : "Your browser blocked the sign-in pop-up. Allow pop-ups for this site (tap the pop-up icon in the address bar) and try again.";
    }
    console.error(err);
    return language === "bn"
      ? `${providerName} সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।`
      : `${providerName} sign-in failed. Please try again.`;
  };

  const handlePostGoogleAuth = async (fbUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", fbUser.uid);
    const userSnap = await getDoc(userDocRef);

    let isAdminUser = false;
    try {
      const adminDoc = await getDoc(doc(db, "admins", fbUser.uid));
      isAdminUser = adminDoc.exists();
    } catch (err) {
      console.error("Admin check at login failed:", err);
    }

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
        isAdmin: isAdminUser,
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
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await handlePostGoogleAuth(result.user);
        }
      } catch (err: any) {
        console.error("Redirect sign-in failed:", err);
        const msg = getAuthErrorMessage(err, "google");
        if (msg) safeSetError(msg);
      } finally {
        safeSetLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setStep("start");
      setError("");
      setPhoneAuthMode("login");
      setPhonePassword("");
      setPhonePasswordConfirm("");
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
    if (authInProgressRef.current) return; // duplicate tap guard
    authInProgressRef.current = true;
    safeSetError("");
    safeSetLoading(true);

    // Google-এর নিজস্ব নীতিতে Facebook/Instagram/Messenger-এর ভেতরের in-app
    // browser (embedded WebView)-এ OAuth popup ও redirect দুটোই ব্লক করে দেয়
    // ("disallowed_useragent") -- এটা কোনো bug না, তাই popup/redirect চেষ্টা
    // করে সময় নষ্ট না করে সরাসরি আসল Chrome ব্রাউজারে খুলতে বলা হচ্ছে।
    if (isInAppBrowser) {
      safeSetError(
        language === "bn"
          ? "এই in-app browser-এ (Facebook/Messenger/Instagram) Google সাইন-ইন কাজ করে না। নিচের বাটনে চেপে Chrome-এ খুলুন।"
          : "Google sign-in doesn't work inside this in-app browser (Facebook/Messenger/Instagram). Tap below to open in Chrome."
      );
      safeSetLoading(false);
      authInProgressRef.current = false;
      return;
    }

    try {
      // Popup first on every device. signInWithRedirect depends on Firebase's
      // authDomain (garibazar-bd.firebaseapp.com) sharing storage/cookies with
      // this app's real hosting domain to hand back the result — Chrome's
      // third-party storage partitioning breaks that bridge, which is why
      // redirect sign-in was silently failing to persist. Popup avoids that
      // entirely since it completes and resolves in the same tab session.
      const popupResult = signInWithPopup(auth, googleProvider);
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("popup-timeout")), 30000);
      });
      const result = await Promise.race([popupResult, timeout]);
      await handlePostGoogleAuth(result.user);
    } catch (err: any) {
      const code = err?.code || "";
      const shouldFallbackToRedirect =
        err?.message === "popup-timeout" ||
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment";

      if (shouldFallbackToRedirect) {
        try {
          // পুরো পেজ Google-এর সাইটে নিয়ে যাবে এবং ফিরে এসে getRedirectResult
          // effect-এ ফলাফল ধরা পড়বে -- তাই এখানে loading=true রাখাই ঠিক,
          // finally ব্লক এই কেসে চালানো হচ্ছে না (নিচে return দিয়ে skip করা)।
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          console.error("Redirect fallback also failed:", redirectErr);
          const msg = getAuthErrorMessage(redirectErr, "google");
          if (msg) safeSetError(msg);
          safeSetLoading(false);
          authInProgressRef.current = false;
          return;
        }
      }

      const msg = getAuthErrorMessage(err, "google");
      if (msg) safeSetError(msg);
    } finally {
      safeSetLoading(false);
      authInProgressRef.current = false;
    }
  };

  const handleFacebookSignIn = async () => {
    if (authInProgressRef.current) return; // duplicate tap guard
    authInProgressRef.current = true;
    safeSetError("");
    safeSetLoading(true);
    try {
      const popupResult = signInWithPopup(auth, facebookProvider);
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("popup-timeout")), 30000);
      });
      const result = await Promise.race([popupResult, timeout]);
      await handlePostGoogleAuth(result.user);
    } catch (err: any) {
      const code = err?.code || "";
      const shouldFallbackToRedirect =
        err?.message === "popup-timeout" ||
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        isInAppBrowser;

      if (shouldFallbackToRedirect) {
        try {
          await signInWithRedirect(auth, facebookProvider);
          return;
        } catch (redirectErr: any) {
          console.error("Redirect fallback also failed:", redirectErr);
          const msg = getAuthErrorMessage(redirectErr, "facebook");
          if (msg) safeSetError(msg);
          safeSetLoading(false);
          authInProgressRef.current = false;
          return;
        }
      }

      const msg = getAuthErrorMessage(err, "facebook");
      if (msg) safeSetError(msg);
    } finally {
      safeSetLoading(false);
      authInProgressRef.current = false;
    }
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
        if (data.code === "ALREADY_REGISTERED") {
          setPhoneAuthMode("login");
        }
        setError(data.error || (language === "bn" ? "অ্যাকাউন্ট তৈরি করা যায়নি।" : "Could not create account."));
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
        isAdmin: false,
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
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">
              {language === "bn"
                ? "গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য সাইন-ইন করুন।"
                : "Sign in to buy or sell on Gari Bazar."}
            </p>
            {SOCIAL_LOGIN_ENABLED && isInAppBrowser && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-400 text-center space-y-2">
                <p>
                  {language === "bn"
                    ? "Facebook/Messenger/Instagram-এর ভেতরের browser-এ Google সাইন-ইন কাজ করবে না।"
                    : "Google sign-in won't work inside Facebook/Messenger/Instagram's built-in browser."}
                </p>
                <button
                  type="button"
                  onClick={openInChrome}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  {language === "bn" ? "Chrome ব্রাউজারে খুলুন →" : "Open in Chrome →"}
                </button>
              </div>
            )}
            {SOCIAL_LOGIN_ENABLED && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <GoogleIcon />}
              </span>
              {language === "bn" ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
            </button>
            )}
            {SOCIAL_LOGIN_ENABLED && (
            <button
              type="button"
              onClick={handleFacebookSignIn}
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-60 text-slate-800 font-semibold rounded-xl text-sm flex items-center justify-center gap-3 border border-slate-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-white dark:border-slate-700"
            >
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <FacebookIcon />
              </span>
              {language === "bn" ? "Facebook দিয়ে চালিয়ে যান" : "Continue with Facebook"}
            </button>
            )}
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
                : (language === "bn" ? "নতুন অ্যাকাউন্ট তৈরি করতে মোবাইল নম্বর ও পাসওয়ার্ড দিন।" : "Enter a mobile number and password to create your account.")}
            </p>
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
              <input
                type="tel"
                required
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="01XXXXXXXXX"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "পাসওয়ার্ড *" : "Password *"}</label>
              <input
                type="password"
                required
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder={language === "bn" ? "কমপক্ষে ৮ ক্যারেক্টার" : "At least 8 characters"}
              />
            </div>
            {phoneAuthMode === "signup" && (
              <div>
                <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "পাসওয়ার্ড আবার দিন *" : "Confirm Password *"}</label>
                <input
                  type="password"
                  required
                  value={phonePasswordConfirm}
                  onChange={(e) => setPhonePasswordConfirm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  placeholder={language === "bn" ? "পাসওয়ার্ড আবার লিখুন" : "Re-enter password"}
                />
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {phoneAuthMode === "login"
                ? (language === "bn" ? "সাইন-ইন করুন" : "Sign In")
                : (language === "bn" ? "অ্যাকাউন্ট তৈরি করুন" : "Create Account")}
            </button>
            <div className="flex items-center justify-between gap-2 text-xs pt-1">
              <button type="button" onClick={() => { setError(""); setStep("start"); }} className="flex items-center gap-1 text-slate-500 hover:underline shrink-0">
                <ArrowLeft className="w-3 h-3" />
                {language === "bn" ? "পেছনে যান" : "Back"}
              </button>
              <button
                type="button"
                onClick={() => { setError(""); setPhoneAuthMode(phoneAuthMode === "login" ? "signup" : "login"); }}
                className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline text-right"
              >
                {phoneAuthMode === "login"
                  ? (language === "bn" ? "নতুন অ্যাকাউন্ট তৈরি করুন" : "Create new account")
                  : (language === "bn" ? "আগে থেকে অ্যাকাউন্ট আছে? সাইন-ইন" : "Already have an account? Sign in")}
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

            <div className="flex justify-center mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800"
              >
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

            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "আপনার নাম *" : "Name *"}</label>
              <div className="relative">
                <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder={language === "bn" ? "আপনার নাম লিখুন" : "Your name"} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
              <div className="relative">
                <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="01XXXXXXXXX" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {language === "bn" ? "এই নম্বরে OTP পাঠানো হবে না — শুধু যোগাযোগের জন্য দেখানো হবে।" : "No OTP is sent here — it's shown to buyers as your contact number."}
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "জেলা *" : "District *"}</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white appearance-none">
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {uploadingPhoto
                ? (language === "bn" ? "ছবি আপলোড হচ্ছে..." : "Uploading photo...")
                : (language === "bn" ? "প্রোফাইল তৈরি করুন" : "Create Profile")}
            </button>

            <button type="button" onClick={handleCancelProfileStep} className="w-full text-center text-xs text-slate-500 hover:underline">
              {language === "bn" ? "← বাতিল করুন" : "← Cancel"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
