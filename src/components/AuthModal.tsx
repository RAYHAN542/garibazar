import React, { useState, useRef } from "react";
import { auth, db } from "../firebase";
import { signInAnonymously, signInWithCustomToken } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { X, Phone, User, MapPin, Loader2, Sparkles, Camera } from "lucide-react";
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

// Resizes/compresses a picked profile photo client-side before it goes to Cloudinary,
// so uploads stay fast on slow connections and don't waste storage.
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

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- OTP ধাপের জন্য নতুন state ---
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otpCode, setOtpCode] = useState("");
  const [otpTempIdToken, setOtpTempIdToken] = useState("");
  const [otpExistingData, setOtpExistingData] = useState<any>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  React.useEffect(() => {
    if (!isOpen) {
      setStep("form");
      setOtpCode("");
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

  // ধাপ ১: ফর্ম সাবমিট হলে প্রথমে OTP পাঠাই — সরাসরি login/create করি না
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanPhone = phoneNumber.replace(/\D/g, "");

    if (cleanPhone.length !== 11) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }

    setLoading(true);
    try {
      const usersCol = collection(db, "users");
      const q = query(usersCol, where("phoneNumber", "==", cleanPhone));
      const querySnap = await getDocs(q);
      const existingUid = querySnap.empty ? null : querySnap.docs[0].id;
      const existingData = querySnap.empty ? null : querySnap.docs[0].data();

      if (isLogin && !existingUid) {
        setError(language === "bn" ? "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" : "No account found.");
        setLoading(false);
        return;
      }
      if (!isLogin && existingUid) {
        setError(language === "bn" ? "এই নম্বরে অলরেডি একটি অ্যাকাউন্ট আছে।" : "Account already exists.");
        setLoading(false);
        return;
      }

      // ownership যাচাইয়ের জন্য anonymous session লাগবেই, backend request-এ পাঠানোর জন্য
      const tempCredential = await signInAnonymously(auth);
      const tempIdToken = await tempCredential.user.getIdToken();

      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tempIdToken}` },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      });
      if (!otpRes.ok) {
        const errData = await otpRes.json().catch(() => ({}));
        throw new Error(errData.error || "OTP পাঠানো যায়নি।");
      }

      setOtpTempIdToken(tempIdToken);
      setOtpExistingData(existingData);
      setResendCooldown(60);
      setStep("otp");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || (language === "bn" ? "কিছু একটা সমস্যা হয়েছে।" : "Something went wrong."));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    try {
      const otpRes = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${otpTempIdToken}` },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      });
      if (!otpRes.ok) {
        const errData = await otpRes.json().catch(() => ({}));
        throw new Error(errData.error || "OTP পাঠানো যায়নি।");
      }
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.message || (language === "bn" ? "আবার OTP পাঠানো যায়নি।" : "Could not resend OTP."));
    }
  };

  // ধাপ ২: ইউজার OTP দিলে যাচাই করি, তারপরই আসল login/account-creation করি
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const cleanCode = otpCode.replace(/\D/g, "");

    if (cleanCode.length !== 6) {
      setError(language === "bn" ? "৬ ডিজিটের OTP কোড দিন।" : "Enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${otpTempIdToken}` },
        body: JSON.stringify({ phoneNumber: cleanPhone, code: cleanCode, purpose: isLogin ? "login" : "register" }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "OTP যাচাই ব্যর্থ হয়েছে।");
      }

      if (isLogin) {
        // --- লগইন মোড: OTP-verified customToken দিয়ে আসল account-এ সাইন-ইন ---
        const finalCredential = await signInWithCustomToken(auth, verifyData.customToken);
        const realUid = finalCredential.user.uid;
        const existingData = otpExistingData;

        const sessionUser = {
          uid: realUid,
          displayName: existingData.displayName,
          phoneNumber: existingData.phoneNumber,
          city: existingData.city,
          profilePicture: existingData.profilePicture || PRESET_AVATARS[0],
          simulatedCredits: existingData.simulatedCredits ?? 5000,
        };

        localStorage.setItem("gari_bazar_session_user", JSON.stringify(sessionUser));
        onAuthSuccess(sessionUser);
        onClose();
        return;
      }

      // --- নতুন প্রোফাইল তৈরি মোড: OTP verified, এখন anonymous uid দিয়েই account বানাই ---
      {
        const realUid = auth.currentUser!.uid;
        const sanitizedDisplayName = sanitizeText(displayName || "Gari Bazar Seller", 50);
        const myReferralCode = `GB-${cleanPhone.slice(-4)}`;

        let uploadedPhotoUrl = PRESET_AVATARS[0];
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
          uid: realUid,
          displayName: sanitizedDisplayName,
          phoneNumber: cleanPhone,
          city: sanitizeText(city, 50),
          profilePicture: uploadedPhotoUrl,
          createdAt: new Date().toISOString(),
          simulatedCredits: 5000,
          referralCode: myReferralCode,
        };

        await setDoc(doc(db, "users", realUid), savedData);
        localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
        onAuthSuccess(savedData);
        onClose();
      }
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
            {step === "otp"
              ? (language === "bn" ? "OTP যাচাই করুন" : "Verify OTP")
              : isLogin ? (language === "bn" ? "বিক্রেতা লগইন" : "Seller Login") : (language === "bn" ? "নতুন প্রোফাইল খুলুন" : "Create Profile")}
          </h2>
        </div>

        {step === "form" && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-4">
            <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${!isLogin ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm" : "text-slate-500"}`}>
              {language === "bn" ? "নতুন প্রোফাইল" : "Register"}
            </button>
            <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${isLogin ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm" : "text-slate-500"}`}>
              {language === "bn" ? "লগইন" : "Login"}
            </button>
          </div>
        )}

        {error && <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs mb-3 text-center">{error}</div>}

        {step === "otp" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-xs text-slate-500 text-center">
              {language === "bn"
                ? `01${phoneNumber.replace(/\D/g, "").slice(1)} নম্বরে একটি ৬ ডিজিটের কোড পাঠানো হয়েছে`
                : `A 6-digit code was sent to ${phoneNumber}`}
            </p>
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "OTP কোড *" : "OTP Code *"}</label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full px-3 py-2 text-center text-lg tracking-[0.5em] border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                placeholder="______"
              />
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {language === "bn" ? "নিশ্চিত করুন" : "Confirm"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep("form"); setOtpCode(""); setError(""); }} className="text-slate-500 hover:underline">
                {language === "bn" ? "← নম্বর পাল্টান" : "← Change number"}
              </button>
              <button type="button" onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-amber-600 disabled:text-slate-400 font-bold hover:underline disabled:no-underline">
                {resendCooldown > 0
                  ? (language === "bn" ? `আবার পাঠান (${resendCooldown}s)` : `Resend (${resendCooldown}s)`)
                  : (language === "bn" ? "আবার পাঠান" : "Resend OTP")}
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
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
          )}
          {!isLogin && (
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "আপনার নাম *" : "Name *"}</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Rayhan" />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="01993878271" />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="text-[10px] font-bold block mb-1 text-slate-500">{language === "bn" ? "জেলা *" : "District *"}</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white appearance-none">
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {uploadingPhoto
              ? (language === "bn" ? "ছবি আপলোড হচ্ছে..." : "Uploading photo...")
              : isLogin
                ? (language === "bn" ? "লগইন নিশ্চিত করুন" : "Confirm Login")
                : (language === "bn" ? "প্রোফাইল তৈরি করুন" : "Create Profile")}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
