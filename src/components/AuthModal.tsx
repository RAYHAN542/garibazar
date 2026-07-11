import React, { useState, useRef } from "react";
import { auth, db, googleProvider } from "../firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { X, MapPin, Loader2, Sparkles, Camera } from "lucide-react";
import { CITIES } from "../translations";
import { SupportedLanguage } from "../types";
import { sanitizeText, validateBanglaPhone } from "../utils/sanitizer";
import { uploadToCloudinary } from "../utils/cloudinary";

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

  const [step, setStep] = useState<"start" | "profile">("start");
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
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
                ? "গাড়ি বাজারে বিক্রি করতে বা কেনার জন্য Google দিয়ে সাইন-ইন করুন।"
                : "Sign in with Google to buy or sell on Gari Bazar."}
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
          </div>
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
                <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Rayhan" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
              <div className="relative">
                <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="01993878271" />
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
