import React, { useState, useRef } from "react";
import { SupportedLanguage } from "../types";
import { Camera, Loader2, AlertTriangle, X, Check } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { sanitizeText, validatePriceInput, validateBanglaPhone } from "../utils/sanitizer";
import { uploadToCloudinary } from "../utils/cloudinary";
import { CITIES } from "../translations";
import { detectDistrictFromArea } from "../data/areaMap";
import vehicleCardImg from "../assets/images/vehicle-card-new.png";
import partsCardImg from "../assets/images/parts-card-new.png";

interface AddPartFormProps {
  language: SupportedLanguage;
  currentUser: any;
  onPostSuccess: () => void;
  onLoginPrompt: () => void;
  onViewListing?: (listing: any) => void;
}

const compressImageToBlob = async (file: File, maxWidth = 1200, maxHeight = 1200): Promise<{ blob: Blob; dataUrl: string }> => {
  try {
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic");
    let sourceImg: ImageBitmap | HTMLImageElement;
    let width: number;
    let height: number;

    if (!isHeic && typeof createImageBitmap !== "undefined") {
      sourceImg = await createImageBitmap(file);
      width = sourceImg.width;
      height = sourceImg.height;
    } else {
      sourceImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Failed to load image for compression"));
        };
        img.src = objectUrl;
      });
      width = sourceImg.width;
      height = sourceImg.height;
    }

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

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context is null");

    ctx.drawImage(sourceImg, 0, 0, width, height);

    if (typeof (sourceImg as ImageBitmap).close === "function") {
      (sourceImg as ImageBitmap).close();
    }

    let blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to convert canvas to Blob"));
      }, "image/webp", 0.8);
    });

    if (blob.type !== "image/webp") {
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to convert canvas to Blob"));
        }, "image/jpeg", 0.8);
      });
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

    return { blob, dataUrl };
  } catch (err) {
    console.error("Compression error:", err);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    return { blob: file, dataUrl };
  }
};

// বিবরণের প্রথম অংশ থেকে একটা সংক্ষিপ্ত শিরোনাম বানায় (কার্ডে দেখানোর জন্য)।
const deriveTitleFromDescription = (text: string): string => {
  const firstLine = text.split("\n")[0].trim();
  const words = firstLine.split(/\s+/).slice(0, 8).join(" ");
  return (words || text.trim()).slice(0, 60);
};

// বাংলা সংখ্যা (০-৯) থাকলে ইংরেজি সংখ্যায় (0-9) রূপান্তর করে — প্রোফাইলে বাংলা
// সংখ্যায় সেভ করা ফোন নম্বর ভ্যালিডেশনে যেন ব্যর্থ না হয়।
const toEnglishDigits = (str: string): string => {
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  return str.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
};

export function AddPartForm({ language, currentUser, onPostSuccess, onLoginPrompt, onViewListing }: AddPartFormProps) {
  const [activeTab, setActiveTab] = useState<"part" | "vehicle">("part");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(toEnglishDigits(currentUser?.phoneNumber || ""));
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string; url?: string; status: "idle" | "uploading" | "success" | "error"; progress: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageToCloudinary = async (file: File, targetIndex: number) => {
    try {
      const { blob } = await compressImageToBlob(file);
      const url = await uploadToCloudinary(blob);
      setImages(prev => prev.map((img, idx) => idx === targetIndex ? { ...img, status: "success", url, progress: 100 } : img));
    } catch (err) {
      console.error(err);
      setImages(prev => prev.map((img, idx) => idx === targetIndex ? { ...img, status: "error", progress: 0 } : img));
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (images.length + files.length > 5) {
      setError(language === "bn" ? "সর্বোচ্চ ৫টি ছবি আপলোড করা যাবে" : "Maximum 5 images allowed");
      return;
    }

    const currentLength = images.length;
    const newImages = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      status: "uploading" as const,
      progress: 30
    }));

    setImages(prev => [...prev, ...newImages]);
    setError(null);

    await Promise.all(
      newImages.map((img, i) => uploadImageToCloudinary(img.file, currentLength + i))
    );
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onLoginPrompt();
      return;
    }

    // পোস্ট করার আগে Firebase টোকেন জোর করে রিফ্রেশ করা হচ্ছে, যাতে পুরনো/
    // মেয়াদোত্তীর্ণ সেশনের কারণে "permission denied" এরর না আসে। বেশিরভাগ
    // ক্ষেত্রে এটা নিঃশব্দে ঠিক হয়ে যাবে, ইউজার কিছু বুঝতেও পারবে না।
    try {
      await auth.currentUser?.getIdToken(true);
    } catch (tokenErr) {
      console.error("Token refresh failed:", tokenErr);
    }
    if (!auth.currentUser) {
      setError(
        language === "bn"
          ? "আপনার লগইন সেশন মেয়াদোত্তীর্ণ হয়ে গেছে। অনুগ্রহ করে আবার লগইন করুন।"
          : "Your session has expired. Please log in again."
      );
      onLoginPrompt();
      return;
    }

    if (!description.trim()) {
      setError(language === "bn" ? "অনুগ্রহ করে বিবরণ লিখুন" : "Please write a description");
      return;
    }

    const cleanPhoneDigits = toEnglishDigits(phone).replace(/\D/g, "");
    if (!validateBanglaPhone(cleanPhoneDigits)) {
      setError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }

    const uploadedUrls = images.filter(img => img.status === "success" && img.url).map(img => img.url as string);
    if (uploadedUrls.length === 0) {
      setError(language === "bn" ? "কমপক্ষে একটি ছবি সফলভাবে আপলোড হতে হবে" : "At least one image must be successfully uploaded");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cleanDesc = sanitizeText(description);
      const cleanTitle = sanitizeText(deriveTitleFromDescription(description));
      const cleanPrice = price ? validatePriceInput(price) : "0";
      const detectedLocation = detectLocationFromText(description) || "Bangladesh";
      const cleanPhone = sanitizeText(cleanPhoneDigits);

      const parentCategory = activeTab === "vehicle" ? "vehicles" : "general";
      const normalizedSubCategory = activeTab === "vehicle" ? "other_heavy_equipment" : "general";

      const docRef = await addDoc(collection(db, "listings"), {
        title: cleanTitle,
        model: cleanTitle,
        category: parentCategory,
        subCategory: normalizedSubCategory,
        partCategory: "other",
        brand: "",
        condition: "used",
        price: parseFloat(cleanPrice) || 0,
        description: cleanDesc,
        location: detectedLocation,
        contactNumber: cleanPhone,
        images: uploadedUrls,
        sellerId: currentUser.uid,
        sellerName: currentUser.displayName || "Rayhan",
        status: "active",
        createdAt: serverTimestamp(),
        type: activeTab
      });

      if (onViewListing) {
        onViewListing({
          id: docRef.id,
          title: cleanTitle,
          price: parseFloat(cleanPrice) || 0,
          images: uploadedUrls,
          location: detectedLocation,
          category: parentCategory,
          subCategory: normalizedSubCategory,
          description: cleanDesc,
          contactNumber: cleanPhone,
          sellerId: currentUser.uid,
          sellerName: currentUser.displayName || "Rayhan",
          type: activeTab
        });
      }
      window.dispatchEvent(new Event("gari_bazar_refreshed_data"));
      onPostSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-4 rounded-xl shadow-sm">
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {language === "bn" ? "ছবি যোগ করুন (সর্বোচ্চ ৫টি) *" : "Add Photos (Max 5) *"}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square border rounded-xl overflow-hidden bg-gray-50 flex flex-col items-center justify-center p-2">
                <img src={img.preview} alt="preview" className="w-full h-full object-cover rounded-lg" />
                <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white">
                  <X className="w-4 h-4" />
                </button>
                {img.status === "uploading" && (
                  <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-2 text-xs text-gray-600">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    <span>{language === "bn" ? "আপলোড হচ্ছে..." : "Uploading..."}</span>
                  </div>
                )}
                {img.status === "error" && (
                  <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-1 text-xs text-red-500 font-medium">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span>{language === "bn" ? "ব্যর্থ হয়েছে" : "Failed"}</span>
                  </div>
                )}
              </div>
            ))}
            {images.length < 5 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-xs font-medium">{language === "bn" ? `পিক অ্যাড করুন (${images.length}/5)` : `Add Photo (${images.length}/5)`}</span>
              </button>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleImageSelect} multiple accept="image/*" className="hidden" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setActiveTab("vehicle"); setError(null); }}
            className={`relative rounded-2xl border-2 px-3 py-3.5 flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "vehicle" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {activeTab === "vehicle" && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
            <img src={vehicleCardImg} alt="" className="w-full h-14 object-contain" />
            <span className={`text-xs font-bold text-center leading-tight ${activeTab === "vehicle" ? "text-amber-700" : "text-gray-500"}`}>
              {language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("part"); setError(null); }}
            className={`relative rounded-2xl border-2 px-3 py-3.5 flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "part" ? "border-sky-500 bg-sky-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {activeTab === "part" && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
            )}
            <img src={partsCardImg} alt="" className="w-full h-14 object-contain" />
            <span className={`text-xs font-bold text-center leading-tight ${activeTab === "part" ? "text-sky-700" : "text-gray-500"}`}>
              {language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
            </span>
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {language === "bn" ? "দাম (টাকা) (ঐচ্ছিক)" : "Price (BDT) (Optional)"}
          </label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="৳" className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {language === "bn" ? "যোগাযোগের মোবাইল নম্বর *" : "Contact Mobile Number *"}
          </label>
          <input type="tel" value={phone} onChange={(e) => setPhone(toEnglishDigits(e.target.value))} placeholder="01XXXXXXXXX" className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {language === "bn" ? "বিবরণ লিখুন *" : "Write a Description *"}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder={
              language === "bn"
                ? "যা বিক্রি করছেন তার বিস্তারিত লিখুন — নাম, মডেল, অবস্থা, এবং জেলার নাম উল্লেখ করুন যাতে ক্রেতারা সহজে খুঁজে পায়..."
                : "Describe what you're selling — name, model, condition, and mention your district so buyers can find it..."
            }
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:border-orange-500"
            required
          />
        </div>

        <button type="submit" disabled={isSubmitting || images.some(img => img.status === "uploading")} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl text-sm shadow-sm hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{language === "bn" ? "লিস্টিং আপলোড হচ্ছে..." : "Submitting..."}</span>
            </>
          ) : (
            <span>{language === "bn" ? "বিজ্ঞাপনটি পোস্ট করুন" : "Submit Advertisement"}</span>
          )}
        </button>
      </form>
    </div>
  );
}
