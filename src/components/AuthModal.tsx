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
  "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=150&auto=format&fit=crop&q=80"
];

export function AuthModal({ isOpen, onClose, language, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [profilePic, setProfilePic] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateBanglaPhone(phoneNumber)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }

    setLoading(true);
    const cleanPhone = phoneNumber.replace(/\D/g, "");

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
          setError(language === "bn" ? "এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" : "No account found.");
          setLoading(false);
          return;
        }

        await signInAnonymously(auth);

        const sessionUser = {
          uid: existingUid,
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

        // নতুন ইউজারের জন্য ফায়ারবেস অথেনটিকেশন তৈরি
        const userCredential = await signInAnonymously(auth);
        const realUid = userCredential.user.uid;
        const sanitizedDisplayName = sanitizeText(displayName || "Gari Bazar Seller", 50);
        const myReferralCode = `GB-${cleanPhone.slice(-4)}`;

        const savedData = {
          uid: realUid,
          displayName: sanitizedDisplayName,
          phoneNumber: cleanPhone,
          city: sanitizeText(city, 50),
          profilePicture: PRESET_AVATARS[0],
          createdAt: new Date().toISOString(),
          simulatedCredits: 5000,
          referralCode: myReferralCode,
        };

        // ফায়ারস্টোর ডেটাবেজে নতুন ডেটা সেভ করা
        await setDoc(doc(db, "users", realUid), savedData);
        localStorage.setItem("gari_bazar_session_user", JSON.stringify(savedData));
        onAuthSuccess(savedData);
        onClose();
      }
        }
    
      }
    } catch (err) {
      setError(language === "bn" ? "কিছু একটা সমস্যা হয়েছে।" : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {isLogin ? (language === "bn" ? "বিক্রেতা লগইন" : "Seller Login") : (language === "bn" ? "নতুন প্রোফাইল খুলুন" : "Create Profile")}
          </h2>
        </div>

        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-4">
          <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${!isLogin ? "bg-white text-amber-500" : "text-slate-500"}`}>
            {language === "bn" ? "নতুন প্রোফাইল" : "Register"}
          </button>
          <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg ${isLogin ? "bg-white text-amber-500" : "text-slate-500"}`}>
            {language === "bn" ? "লগইন" : "Login"}
          </button>
        </div>

        {error && <div className="p-3 bg-red-500/10 text-red-650 rounded-lg text-xs mb-3">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-[10px] font-bold block mb-1">{language === "bn" ? "আপনার নাম *" : "Name *"}</label>
              <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-950" />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold block mb-1">{language === "bn" ? "মোবাইল নম্বর *" : "Mobile Number *"}</label>
            <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="01XXXXXXXXX" className="w-full p-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-950" />
          </div>

          {!isLogin && (
            <div>
              <label className="text-[10px] font-bold block mb-1">{language === "bn" ? "জেলা *" : "District *"}</label>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-950">
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-2 bg-amber-500 text-slate-950 rounded-lg font-black text-sm flex items-center justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? "লগইন নিশ্চিত করুন" : "প্রোফাইল তৈরি করুন")}
          </button>
        </form>
      </div>
    </div>
  );
      }
        
