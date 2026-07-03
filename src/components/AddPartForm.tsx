import React, { useState, useRef, useEffect } from "react";
import { SupportedLanguage } from "../types";
import { Camera, Loader2, AlertTriangle, X } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { sanitizeText, validatePriceInput } from "../utils/sanitizer";

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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to convert canvas to Blob"));
      }, "image/jpeg", 0.75);
    });

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

export function AddPartForm({ language, currentUser, onPostSuccess, onLoginPrompt, onViewListing }: AddPartFormProps) {
  const [activeTab, setActiveTab] = useState<"part" | "vehicle">("part");
  const [title, setTitle] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("used");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string; url?: string; status: "idle" | "uploading" | "success" | "error"; progress: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser?.phoneNumber) {
      setPhone(currentUser.phoneNumber);
    }
  }, [currentUser]);

  const uploadImageToImgBB = async (file: File, targetIndex: number) => {
    try {
      const { blob } = await compressImageToBlob(file);
      const formData = new FormData();
      formData.append("image", blob, file.name);

      const response = await fetch("https://api.imgbb.com/1/upload?key=9d3bd22c0692e730c5caf7813788f541", {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("ImgBB upload failed");
      const result = await response.json();

      if (result.success && result.data?.url) {
        setImages(prev => prev.map((img, idx) => idx === targetIndex ? { ...img, status: "success", url: result.data.url, progress: 100 } : img));
      } else {
        throw new Error("Invalid response structure");
      }
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

    for (let i = 0; i < newImages.length; i++) {
      await uploadImageToImgBB(newImages[i].file, currentLength + i);
    }
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

    if (!title || !category || !price || !location || !phone) {
      setError(language === "bn" ? "অনুগ্রহ করে সব বাধ্যতামূলক ঘর পূরণ করুন" : "Please fill all required fields");
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
      // সেফটি চেক সহ রানটাইমে স্যানিটাইজেশন নিশ্চিত করা হলো
      const cleanTitle = title ? sanitizeText(title) : "";
      const cleanBrand = brand ? sanitizeText(brand) : "";
      const cleanDesc = description ? sanitizeText(description) : "";
      const cleanPhone = phone ? sanitizeText(phone) : "";
      const cleanPrice = price ? validatePriceInput(price) : "0";

    const collectionName = "listings";
      const docRef = await addDoc(collection(db, collectionName), {
        title: cleanTitle,
        model: model,
        category,
        brand: cleanBrand,
        condition,
        price: parseFloat(cleanPrice) || 0,
        description: cleanDesc,
        location,
        phone: cleanPhone,
        images: uploadedUrls,
        sellerId: currentUser.uid,
        sellerName: currentUser.displayName || "Rayhan",
        status: "active",
        createdAt: serverTimestamp(),
        type: activeTab
      });

      if (onViewListing) {
        onViewListing({ id: docRef.id, title, price, images: uploadedUrls, location, category, type: activeTab });
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
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
        <button type="button" onClick={() => { setActiveTab("part"); setError(null); }} className={`flex-1 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 ${activeTab === "part" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600"}`}>
          🔧 {language === "bn" ? "কার পার্টস কেনা/বেচা" : "Car Parts"}
        </button>
        <button type="button" onClick={() => { setActiveTab("vehicle"); setError(null); }} className={`flex-1 py-2 rounded-md font-medium text-sm flex items-center justify-center gap-2 ${activeTab === "vehicle" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600"}`}>
          🚜 {language === "bn" ? "গাড়ি ও হেভি ইকুইপমেন্ট" : "Vehicles & Heavy Equipment"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {activeTab === "part" ? (language === "bn" ? "১. পার্টস এর ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Part Images (Max 5) *") : (language === "bn" ? "১. গাড়ি বা যন্ত্রপাতির ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Vehicle Images (Max 5) *")}
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
                    <span>{language === "bn" ? "ব্যর্থ হয়েছে" : "Failed"}</span>
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

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "১. মূল্য (BDT) *" : "1. Price (BDT) *"}</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="৳" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "২. মডেল *" : "2. Model *"}</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder={language === "bn" ? "যেমন: টয়োটা এক্সিও ২০১৮" : "e.g. Toyota Axio 2018"} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "৩. ক্যাটাগরি *" : "3. Category *"}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:border-orange-500" required>
                <option value="">{language === "bn" ? "-- সিলেক্ট করুন --" : "-- Select --"}</option>
                {activeTab === "part" ? (
                  <>
                    <option value="Engine">{language === "bn" ? "ইঞ্জিন পার্টস (Engine)" : "Engine"}</option>
                    <option value="Suspension">{language === "bn" ? "সাসপেনশন (Suspension)" : "Suspension"}</option>
                    <option value="Body">{language === "bn" ? "বডি ও এক্সটেরিয়র (Body)" : "Body"}</option>
                    <option value="Interior">{language === "bn" ? "ইন্টেরিয়র (Interior)" : "Interior"}</option>
                    <option value="Electrical">{language === "bn" ? "ইলেকট্রিক্যাল পার্টস" : "Electrical"}</option>
                <option value="other">{language === "bn" ? "অন্যান্য (Other)" : "Other"}</option>
                  </>
                ) : (
                  <>
                    <option value="Car">{language === "bn" ? "কার / গাড়ি (Car)" : "Car"}</option>
                    <option value="Excavator">{language === "bn" ? "এক্সকাভেটর (Excavator)" : "Excavator"}</option>
                    <option value="Truck">{language === "bn" ? "ট্রাক ও কমার্শিয়াল (Truck)" : "Truck"}</option>
                    <option value="Forklift">{language === "bn" ? "ফর্কলিফট (Forklift)" : "Forklift"}</option>
                <option value="other">{language === "bn" ? "অন্যান্য (Other)" : "Other"}</option>
                  </>
                )}
              </select>
            </div>

              {category === "other" && (
                <div className="mt-2">
                  <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder={language === "bn" ? "আপনার আইটেমের নাম লিখুন" : "Type your item name"} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
                </div>
              )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "৪. মোবাইল নাম্বার *" : "4. Mobile Number *"}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "৫. লোকেশন / ঠিকানা *" : "5. Location *"}</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={language === "bn" ? "যেমন: ঢাকা, চট্টগ্রাম" : "e.g. Dhaka"} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{language === "bn" ? "৬. বিস্তারিত বিবরণ *" : "6. Description *"}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={language === "bn" ? "পণ্যটির অবস্থা এবং বিস্তারিত লিখুন..." : "Describe item condition..."} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-orange-500" required />
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
                      
