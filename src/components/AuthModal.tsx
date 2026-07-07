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

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

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
      let existingUid: string | null = null;
      let existingData: any = null;

      const usersCol = collection(db, "users");
      const q = query(usersCol, where("phoneNumber", "==", cleanPhone));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        existingUid = querySnap.docs[0].id;
        existingData = querySnap.docs[0].data();
      }

      if (isLogin) {
        // --- লগইন মোড ---
        if (!existingUid || !existingData) {
          setError(language === "bn" ? "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" : "No account found.");
          setLoading(false);
          return;
        }

        // ধাপ ১: সাময়িক anonymous session বানাই ব্যাকএন্ডে কল করার জন্য
        const tempCredential = await signInAnonymously(auth);
        const tempIdToken = await tempCredential.user.getIdToken();

        // ধাপ ২: ব্যাকএন্ড থেকে আসল uid এর জন্য custom token আনি
        const linkRes = await fetch("/api/auth/link-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tempIdToken}`,
          },
          body: JSON.stringify({ phoneNumber: cleanPhone }),
        });

        if (!linkRes.ok) {
          const errText = await linkRes.text();
          throw new Error("Account linking failed. Status=" + linkRes.status + " Body=" + errText);
        }

        const { customToken } = await linkRes.json();

        // ধাপ ৩: আসল uid দিয়ে sign in করি
        const finalCredential = await signInWithCustomToken(auth, customToken);
        const realUid = finalCredential.user.uid;

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

      } else {
        // --- নতুন প্রোফাইল তৈরি মোড ---
        if (existingUid) {
          setError(language === "bn" ? "এই নম্বরে অলরেডি একটি অ্যাকাউন্ট আছে।" : "Account already exists.");
          setLoading(false);
          return;
        }

        const userCredential = await signInAnonymously(auth);
        const realUid = userCredential.user.uid;
        const sanitizedDisplayName = sanitizeText(displayName || "Gari Bazar Seller", 50);
        const myReferralCode = `GB-${cleanPhone.slice(-4)}`;

        let uploadedPhotoUrl = PRESET_AVATARS[0];
        if (profilePhotoFile) {
          try {
            uploadedPhotoUrl = await uploadToCloudinary(profilePhotoFile);
          } catch (photoErr) {
            console.error("Profile photo upload failed:", photoErr);
            setError(language === "bn" ? "ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন অথবা ছবি ছাড়াই এগিয়ে যান।" : "Photo upload failed. Try again or continue without a photo.");
            setLoading(false);
            return;
          }
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
            {isLogin ? (language === "bn" ? "বিক্রেতা লগইন" : "Seller Login") : (language === "bn" ? "নতুন প্রোফাইল খুলুন" : "Create Profile")}
          </h2>
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-4">
          <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${!isLogin ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm" : "text-slate-500"}`}>
            {language === "bn" ? "নতুন প্রোফাইল" : "Register"}
          </button>
          <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${isLogin ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm" : "text-slate-500"}`}>
            {language === "bn" ? "লগইন" : "Login"}
          </button>
        </div>

        {error && <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs mb-3 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="flex justify-center mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800"
              >
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-slate-400" />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] font-bold text-center py-0.5">
                  {language === "bn" ? "ছবি দিন" : "Add Photo"}
                </div>
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
            {isLogin ? (language === "bn" ? "লগইন নিশ্চিত করুন" : "Confirm Login") : (language === "bn" ? "প্রোফাইল তৈরি করুন" : "Create Profile")}
          </button>
        </form>
      </div>
    </div>
  );
}
