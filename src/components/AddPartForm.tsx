import React, { useState, useRef } from "react";
import { SupportedLanguage } from "../types";
import { Camera, Loader2, AlertTriangle, X, Video } from "lucide-react";
import { supabase } from "../supabase";
import { sanitizeText, validatePriceInput, validateBanglaPhone } from "../utils/sanitizer";
import { uploadToCloudinary } from "../utils/cloudinary";
import { prepareVideo, uploadVideoToR2 } from "../utils/videoUpload";
import { captureVideoPoster } from "../utils/videoPoster";
import { nativeFetch } from "../utils/nativeFetch";
import { apiUrl } from "../utils/apiBase";
import { CITIES } from "../translations";
import { detectDistrictFromArea } from "../data/areaMap";
import vehicleCardImg from "../assets/images/vehicle-card-new.webp";
import partsCardImg from "../assets/images/parts-card-new.webp";

interface AddPartFormProps {
  language: SupportedLanguage;
  currentUser: any;
  onPostSuccess: () => void;
  onLoginPrompt: () => void;
  onViewListing?: (listing: any) => void;
  // "photo" (default) = the normal sell form with photos only.
  // "video" = the video-post form opened from the "গাড়ির ভিডিও দেখুন" feed:
  // a video (max 20 sec) instead of photos; the cover photo is taken from the
  // video automatically.
  mode?: "photo" | "video";
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

// বিবরণের লেখা থেকে জেলার নাম (ইংরেজি বা বাংলা) খুঁজে বের করে, ফিল্টার সিস্টেমের
// জন্য প্রয়োজনীয় নির্দিষ্ট ফরম্যাটে রিটার্ন করে (যেমন: "Dhaka (ঢাকা)")।
const detectLocationFromText = (text: string): string => {
  if (!text) return "";
  const lowerText = text.toLowerCase();
  for (const city of CITIES) {
    const match = city.match(/^([^(]+)\(([^)]+)\)$/);
    if (!match) continue;
    const enName = match[1].trim();
    const bnName = match[2].trim();
    if (bnName && text.includes(bnName)) return city;
    if (enName && lowerText.includes(enName.toLowerCase())) return city;
  }
  // জেলার নাম সরাসরি না পেলে, থানা/উপজেলার নাম (যেমন "বনানী", "ভালুকা") দিয়ে
  // চেষ্টা করে দেখো সেটা কোন জেলার অন্তর্গত।
  const districtFromArea = detectDistrictFromArea(text);
  if (districtFromArea) return districtFromArea;
  return "";
};

// 🔧 (2026-09-26) আগে "vehicle" টাইপের প্রতিটা পোস্টই hardcode করে
// sub_category="other_heavy_equipment" পেত -- আসলে গাড়ি/বাইক/ট্রাক যা-ই হোক
// না কেন। ফলে হোমপেজের "Car"/"Bike"/"Truck" quick-filter icon-গুলো এই
// পোস্টগুলো subCategory ফিল্ডে কখনো খুঁজে পেত না (শুধু বিবরণে keyword থাকলে
// text-fallback দিয়ে ধরা পড়ত), আর "Heavy Equip." ফিল্টারে ক্লিক করলে
// আসলে-heavy-machinery-না এমন সব গাড়ি/বাইকও দেখাত (matchesSubCategoryFilter-এ
// subCategory মিলে গেলে সরাসরি true হয়ে যায়, বিবরণ না দেখেই)। এই ফাংশনটা
// listingFilters.ts-এর matchesSubCategoryFilter-এ যে একই কীওয়ার্ড ব্যবহার হয়
// সেগুলো দিয়েই বিবরণ থেকে সঠিক sub-category অনুমান করে, যাতে পোস্ট করার
// সময়েই ঠিকভাবে ট্যাগ হয়ে যায়।
//
// 🔧 (2026-09-26, second fix) ডিফল্ট fallback আগে ছিল "other_heavy_equipment"
// -- কিন্তু অনেক গাড়ির পোস্টে শুধু মডেলের নাম থাকে ("COROLLA 110", "Premio",
// "Axio"), "car"/"toyota" শব্দ literally থাকে না, তাই ভুলভাবে heavy equipment
// হিসেবে ট্যাগ হয়ে যেত। Heavy equipment পোস্টে প্রায় সবসময়ই স্পষ্ট শব্দ
// (excavator/crane/bulldozer) থাকে, কিন্তু সাধারণ গাড়িতে না-ও থাকতে পারে --
// তাই ডিফল্ট এখন "car" (সংখ্যায় সবচেয়ে বেশি এবং misclassify হলে কম ক্ষতিকর)।
const detectVehicleSubCategory = (text: string): string => {
  const t = (text || "").toLowerCase();
  if (/excavator|এক্সক্যাভেটর|এক্সকাভেটর/.test(t)) return "excavator";
  if (/crane|ক্রেন/.test(t)) return "crane";
  if (/bulldozer|বুলডোজার|dozer/.test(t)) return "bulldozer";
  if (/forklift|ফর্কলিফ্ট|forkclip/.test(t)) return "forklift";
  if (/microbus|মাইক্রোবাস|hiace|হাইয়েস/.test(t)) return "microbus";
  if (/(^|[^a-z])bus([^a-z]|$)|বাস/.test(t)) return "bus";
  if (/truck|ট্রাক|lorry|লরি|covered van|কাভার্ড ভ্যান/.test(t)) return "truck";
  if (/bike|বাইক|motorcycle|মোটরসাইকেল|scooter|স্কুটার|yamaha|bajaj/.test(t)) return "bike";
  return "car";
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

type VideoState = {
  preview: string;
  blob?: Blob;
  url?: string;
  status: "processing" | "ready" | "uploading" | "success" | "error";
  progress: number;
  errorMessage?: string;
};

export function AddPartForm({ language, currentUser, onPostSuccess, onLoginPrompt, onViewListing, mode = "photo" }: AddPartFormProps) {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(toEnglishDigits(currentUser?.phoneNumber || ""));
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string; url?: string; status: "idle" | "uploading" | "success" | "error"; progress: number; errorMessage?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 🎬 ভিডিও-মোডে (গাড়ির ভিডিও ফিড থেকে খোলা) সেলারের ভিডিও (সর্বোচ্চ ২০ সেকেন্ড)।
  // videoJobRef শুধু নিশ্চিত করে যে ভিডিও মুছে নতুন ভিডিও বাছলে পুরনো কাজের ফলাফল
  // নতুনটার ওপর বসে না যায়।
  const [video, setVideo] = useState<VideoState | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoJobRef = useRef(0);
  // 🔧 (2026-10-01) ফর্মটা বড়, আর submit বাটন একদম নিচে। আগে error শুধু
  // ফর্মের সবার উপরে দেখানো হতো -- ইউজার নিচে scroll করে থেকে submit চাপলে
  // validation fail হলেও error message দেখতে পেত না (স্ক্রিনের বাইরে)।
  // এখন submit চাপার পর error এলে স্বয়ংক্রিয়ভাবে সেই জায়গায় scroll হয়ে
  // যায়, আর submit বাটনের ঠিক উপরেও একই বার্তা দেখানো হয় (duplicate), যাতে
  // scroll কোনো কারণে কাজ না করলেও ইউজার কারণটা দেখতে পায়।
  const errorBannerRef = useRef<HTMLDivElement>(null);

  // অ্যাকাউন্ট ছাড়া পোস্ট: ব্যবহারকারী শুধু ফোন নম্বর দেয়, ভেতরে ভেতরে সেই নম্বরে অ্যাকাউন্ট
  // খুলে নেওয়া হয় (এলোমেলো পাসওয়ার্ড এই ফোনেই সেভ থাকে)। নম্বরে আগে থেকে অ্যাকাউন্ট থাকলে
  // এই ফোনের সেভ করা পাসওয়ার্ড দিয়ে ঢোকার চেষ্টা হয়, না পারলে false রিটার্ন করে।
  const guestUserRef = useRef<{ uid: string; phone: string } | null>(null);
  const getUid = (): string | undefined => currentUser?.uid || guestUserRef.current?.uid;

  const ensureGuestSession = async (cleanPhone: string): Promise<boolean> => {
    const callAuth = async (action: "signup" | "login", password: string) => {
      const resp = await nativeFetch(apiUrl("/api/auth/phone"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, phone: cleanPhone, password }),
      });
      return { ok: resp.ok, data: await resp.json() } as { ok: boolean; data: any };
    };

    let saved: { phone: string; password: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem("gari_bazar_guest_cred") || "null");
    } catch (e) {}

    let result: { ok: boolean; data: any };
    const hasSaved = !!saved && saved.phone === cleanPhone;
    if (hasSaved && saved) {
      result = await callAuth("login", saved.password);
    } else {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const password = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      result = await callAuth("signup", password);
      if (result.ok) {
        try {
          localStorage.setItem("gari_bazar_guest_cred", JSON.stringify({ phone: cleanPhone, password }));
        } catch (e) {}
      }
    }

    if (!result.ok) {
      if (hasSaved || result.data?.code === "ALREADY_REGISTERED") return false;
      throw new Error(result.data?.error || "Account could not be created");
    }

    await supabase.auth.setSession({
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
    });
    guestUserRef.current = { uid: result.data.uid, phone: result.data.phone };
    return true;
  };

  const showError = (msg: string) => {
    setError(msg);
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const uploadImageToCloudinary = async (file: File, targetIndex: number) => {
    try {
      const { blob } = await compressImageToBlob(file);
      const url = await uploadToCloudinary(blob);
      setImages(prev => prev.map((img, idx) => idx === targetIndex ? { ...img, status: "success", url, progress: 100 } : img));
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err) || "Unknown error";
      setImages(prev => prev.map((img, idx) => idx === targetIndex ? { ...img, status: "error", progress: 0, errorMessage: msg } : img));
    }
  };

  // ছবি যোগ করার সাধারণ কাজ -- ফটো-মোডে ছবি বাছাই আর ভিডিও-মোডে ভিডিও থেকে তোলা কভার
  // ছবি, দুটোই এখান দিয়ে যায়। baseLength হলো এই ফাইলগুলো যোগ হওয়ার আগে তালিকায় কয়টা ছবি ছিল।
  const addImageFiles = async (files: File[], baseLength: number) => {
    const newImages = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      status: (currentUser ? "uploading" : "idle") as "uploading" | "idle",
      progress: 30
    }));

    setImages(prev => [...prev, ...newImages]);
    setError(null);

    // অ্যাকাউন্ট ছাড়া ব্যবহারকারীর ছবি পোস্ট চাপার সময় আপলোড হবে
    if (!currentUser) return;

    await Promise.all(
      newImages.map((img, i) => uploadImageToCloudinary(img.file, baseLength + i))
    );
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (images.length + files.length > 5) {
      showError(language === "bn" ? "সর্বোচ্চ ৫টি ছবি আপলোড করা যাবে" : "Maximum 5 images allowed");
      return;
    }

    await addImageFiles(files, images.length);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // 🎬 ভিডিও বাছাই: আগে ভিডিও থেকে কভার ছবি তোলা হয়, তারপর ফোনেই প্রথম ২০ সেকেন্ড রেখে
  // ছোট করা হয় (prepareVideo), তারপর লগইন থাকলে সঙ্গে সঙ্গে R2-তে আপলোড। অ্যাকাউন্ট ছাড়া
  // ইউজারের ভিডিও "ready" অবস্থায় থাকে আর ছবির মতোই পোস্ট চাপার সময় আপলোড হয়।
  const updateVideo = (job: number, patch: Partial<VideoState>) => {
    if (job !== videoJobRef.current) return;
    setVideo(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const clearImages = () => {
    setImages(prev => {
      prev.forEach(img => URL.revokeObjectURL(img.preview));
      return [];
    });
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      showError(language === "bn" ? "শুধু ভিডিও ফাইল দিন" : "Please choose a video file");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showError(language === "bn" ? "এই ভিডিওটি অনেক বড়। আরও ছোট ভিডিও দিন" : "This video is too large. Please choose a shorter one");
      return;
    }

    setError(null);
    if (video?.preview) URL.revokeObjectURL(video.preview);
    clearImages();
    const job = ++videoJobRef.current;
    setVideo({ preview: URL.createObjectURL(file), status: "processing", progress: 0 });

    try {
      const poster = await captureVideoPoster(file);
      if (job !== videoJobRef.current) return;
      void addImageFiles([poster], 0);

      const blob = await prepareVideo(file, (p) => updateVideo(job, { progress: p }));
      if (job !== videoJobRef.current) return;
      if (currentUser) {
        updateVideo(job, { blob, status: "uploading", progress: 0 });
        const url = await uploadVideoToR2(blob, (p) => updateVideo(job, { progress: p }));
        updateVideo(job, { url, status: "success", progress: 100 });
      } else {
        updateVideo(job, { blob, status: "ready", progress: 100 });
      }
    } catch (err: any) {
      console.error("Video failed:", err);
      updateVideo(job, { status: "error", progress: 0, errorMessage: err?.message || String(err) });
    }
  };

  const removeVideo = () => {
    videoJobRef.current++;
    if (video?.preview) URL.revokeObjectURL(video.preview);
    setVideo(null);
    clearImages();
  };

  // ফর্ম সাবমিট করলে সরাসরি পোস্ট হয় না -- আগে সব ফিল্ড ভ্যালিডেট করে
  // ক্যাটাগরি বাছাইয়ের মডাল দেখানো হয়। ইউজার গাড়ি/পার্ট বাছাই করলে
  // submitListing() আসল Supabase write টা করে।
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      showError(language === "bn" ? "অনুগ্রহ করে বিবরণ লিখুন" : "Please write a description");
      return;
    }

    const cleanPhoneDigits = toEnglishDigits(phone).replace(/\D/g, "");
    if (!validateBanglaPhone(cleanPhoneDigits)) {
      showError(language === "bn" ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন" : "Enter a valid 11-digit phone number");
      return;
    }

    if (mode === "video" && !video) {
      showError(language === "bn" ? "অনুগ্রহ করে একটি ভিডিও যোগ করুন" : "Please add a video");
      return;
    }

    if (video && video.status === "error") {
      showError(language === "bn" ? "ভিডিও ঠিকমতো তৈরি হয়নি। ভিডিও মুছে আবার দিন।" : "The video could not be prepared. Remove it and try again.");
      return;
    }

    const uploadedUrls = images.filter(img => img.status === "success" && img.url).map(img => img.url as string);
    if (!currentUser) {
      if (images.length === 0) {
        showError(language === "bn" ? "কমপক্ষে একটি ছবি দিন" : "Please add at least one photo");
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await ensureGuestSession(cleanPhoneDigits);
        if (!ok) {
          showError(language === "bn" ? "এই নম্বরে আগে থেকেই অ্যাকাউন্ট আছে। অনুগ্রহ করে লগইন করুন।" : "This number already has an account. Please log in.");
          onLoginPrompt();
          return;
        }
        const pending = images.map((img, idx) => ({ img, idx })).filter(({ img }) => img.status !== "success");
        setImages(prev => prev.map(img => img.status === "success" ? img : { ...img, status: "uploading", progress: 30, errorMessage: undefined }));
        await Promise.all(pending.map(({ img, idx }) => uploadImageToCloudinary(img.file, idx)));

        // 🎬 অ্যাকাউন্ট ছাড়া ইউজারের ভিডিওও এখন, সেশন তৈরি হওয়ার পর, আপলোড হয়।
        if (video && video.status === "ready" && video.blob) {
          const job = videoJobRef.current;
          updateVideo(job, { status: "uploading", progress: 0 });
          try {
            const url = await uploadVideoToR2(video.blob, (p) => updateVideo(job, { progress: p }));
            updateVideo(job, { url, status: "success", progress: 100 });
          } catch (vErr: any) {
            console.error("Guest video upload failed:", vErr);
            updateVideo(job, { status: "error", progress: 0, errorMessage: vErr?.message || String(vErr) });
            throw new Error(language === "bn" ? "ভিডিও আপলোড হয়নি। ভিডিও মুছে আবার দিন।" : "Video upload failed. Remove the video and try again.");
          }
        }
      } catch (err: any) {
        console.error("Guest account failed:", err);
        showError(err?.message || (language === "bn" ? "অ্যাকাউন্ট খোলা যায়নি, আবার চেষ্টা করুন" : "Could not continue, please try again"));
        return;
      } finally {
        setIsSubmitting(false);
      }
      setError(null);
      setShowCategoryModal(true);
      return;
    }

    if (uploadedUrls.length === 0) {
      showError(language === "bn" ? "কমপক্ষে একটি ছবি সফলভাবে আপলোড হতে হবে" : "At least one image must be successfully uploaded");
      return;
    }

    setError(null);
    setShowCategoryModal(true);
  };

  const submitListing = async (selectedType: "part" | "vehicle") => {
    setShowCategoryModal(false);
    const cleanPhoneDigits = toEnglishDigits(phone).replace(/\D/g, "");
    const uploadedUrls = images.filter(img => img.status === "success" && img.url).map(img => img.url as string);
    const videoUrl = video && video.status === "success" ? video.url : undefined;
    if (mode === "video" && !videoUrl) {
      showError(language === "bn" ? "ভিডিও আপলোড হয়নি। ভিডিও মুছে আবার দিন।" : "Video upload failed. Remove the video and add it again.");
      return;
    }
    if (uploadedUrls.length === 0) {
      showError(language === "bn" ? "ছবি আপলোড হয়নি। ছবি মুছে আবার দিন।" : "Photo upload failed. Remove the photo and add it again.");
      return;
    }
    // ইউজার অবজেক্টে uid না থাকলে (যেমন ভিন্ন ধরনের user অবজেক্ট) সরাসরি Supabase সেশন থেকে নেওয়া হয়।
    const sellerUid = getUid() || (await supabase.auth.getSession()).data.session?.user?.id;
    if (!sellerUid) {
      showError(language === "bn" ? "অনুগ্রহ করে আবার চেষ্টা করুন" : "Please try again");
      return;
    }
    const sellerDisplayName = currentUser?.displayName || (language === "bn" ? "বেনামী" : "Anonymous");
    setIsSubmitting(true);
    setError(null);

    try {
      const cleanDesc = sanitizeText(description);
      const cleanTitle = sanitizeText(deriveTitleFromDescription(description));
      const cleanPrice = price ? String(validatePriceInput(price)) : "0";
      const detectedLocation = detectLocationFromText(description) || "Bangladesh";
      const cleanPhone = sanitizeText(cleanPhoneDigits);

      const parentCategory = selectedType === "vehicle" ? "vehicles" : "general";
      // 🔧 আগে এখানে সবসময় "other_heavy_equipment" hardcode করা হতো -- এখন
      // বিবরণ থেকে আসল ধরন (car/bike/truck/bus/excavator ইত্যাদি) অনুমান করা
      // হয়, যাতে হোমপেজের quick-filter icon-গুলো সঠিকভাবে কাজ করে।
      const normalizedSubCategory = selectedType === "vehicle" ? detectVehicleSubCategory(description) : "general";

      // Written to Supabase now (App.tsx reads listings from Supabase -
      // USE_SUPABASE_LISTINGS = true). The 30s cooldown is enforced by a
      // Postgres trigger on the listings table, so no separate write for
      // it is needed here - it fires automatically as part of the insert.
      const { data: insertedListing, error: insertError } = await supabase
        .from("listings")
        .insert({
          title: cleanTitle,
          model: cleanTitle,
          category: parentCategory,
          sub_category: normalizedSubCategory,
          brand: "",
          price: parseFloat(cleanPrice) || 0,
          description: cleanDesc,
          location: detectedLocation,
          images: uploadedUrls,
          seller_id: sellerUid,
          seller_name: sellerDisplayName,
          type: selectedType,
          // 🎬 শুধু ভিডিও থাকলেই এই তিনটা কলাম পাঠানো হয় -- ভিডিওছাড়া পোস্টের কোনো পরিবর্তন নেই।
          ...(videoUrl ? { video_url: videoUrl, has_video: true, is_video: true } : {})
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      // ফোন নম্বর আলাদা টেবিলে — মূল listings টেবিলে না রাখায় সেটা পাবলিক
      // select policy-র আওতায় পড়ে না, তাই কেউ লগইন ছাড়া bulk স্ক্র্যাপ
      // করে সব সেলারের নম্বর নিতে পারবে না।
      const { error: contactError } = await supabase
        .from("listing_contacts")
        .insert({
          listing_id: insertedListing.id,
          seller_id: sellerUid,
          phone: cleanPhone
        });

      if (contactError) {
        console.error("Failed to save contact number:", contactError);
      }

      const docRef = { id: insertedListing.id };

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
          sellerId: sellerUid,
          sellerName: sellerDisplayName,
          type: selectedType,
          ...(videoUrl ? { videoUrl, hasVideo: true, isVideo: true } : {})
        });
      }
      window.dispatchEvent(new Event("gari_bazar_refreshed_data"));
      onPostSuccess();
    } catch (err: any) {
      console.error("Listing submit failed:", err?.code, err?.message, err);
      // The cooldown trigger raises errcode P0001 with this message.
      if (err?.code === "P0001" || err?.message?.includes("listing_cooldown_active")) {
        showError(
          language === "bn"
            ? "আপনি একটু আগেই একটা বিজ্ঞাপন পোস্ট করেছেন। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।"
            : "You just posted a listing. Please wait a bit and try again."
        );
      } else if (err?.code === "42501" || err?.status === 403) {
        // Postgres/PostgREST permission-denied (RLS rejection).
        showError(
          language === "bn"
            ? "পোস্ট করা যায়নি (permission denied)। অনুগ্রহ করে লগআউট করে আবার লগইন করে চেষ্টা করুন। সমস্যা থাকলে সাপোর্টে যোগাযোগ করুন।"
            : "Couldn't post your listing (permission denied). Please log out and log back in, then try again. Contact support if this continues."
        );
      } else {
        showError(err.message || "Submission failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-4 rounded-xl shadow-sm">
      {error && (
        <div ref={errorBannerRef} className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-5">
        {mode === "photo" && (
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
                  <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-1 text-[10px] leading-tight text-red-500 font-medium p-1 text-center overflow-hidden">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="break-words">{img.errorMessage || (language === "bn" ? "ব্যর্থ হয়েছে" : "Failed")}</span>
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
        )}

        {mode === "video" && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            {language === "bn" ? "ভিডিও যোগ করুন (সর্বোচ্চ ২০ সেকেন্ড) *" : "Add Video (max 20 seconds) *"}
          </label>
          {video ? (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video src={video.preview} muted playsInline controls preload="metadata" className="w-full max-h-64 object-contain" />
              <button type="button" onClick={removeVideo} className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white">
                <X className="w-4 h-4" />
              </button>
              {(video.status === "processing" || video.status === "uploading") && (
                <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center gap-2 text-xs text-gray-700 font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                  <span>
                    {video.status === "processing"
                      ? (language === "bn" ? "ভিডিও প্রস্তুত হচ্ছে..." : "Preparing video...")
                      : (language === "bn" ? "ভিডিও আপলোড হচ্ছে..." : "Uploading video...")}{" "}
                    {video.progress}%
                  </span>
                </div>
              )}
              {video.status === "error" && (
                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-1 text-[11px] leading-tight text-red-500 font-medium p-3 text-center overflow-hidden">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="break-words">{video.errorMessage || (language === "bn" ? "ব্যর্থ হয়েছে" : "Failed")}</span>
                </div>
              )}
              {(video.status === "success" || video.status === "ready") && (
                <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded-full bg-green-600 text-white text-[11px] font-bold">
                  {language === "bn" ? "ভিডিও রেডি" : "Video ready"}
                </span>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => videoInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-red-300 rounded-xl flex flex-col items-center justify-center gap-2 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
              <Video className="w-7 h-7" />
              <span>{language === "bn" ? "ভিডিও বাছাই করুন (২০ সেকেন্ড)" : "Choose Video (20 sec)"}</span>
            </button>
          )}
          <input type="file" ref={videoInputRef} onChange={handleVideoSelect} accept="video/*" className="hidden" />
        </div>
        )}

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

        {/* 🔧 (2026-10-01) Submit বাটনের ঠিক উপরে একই error দ্বিতীয়বার --
            ইউজার যেখানে থেকে Submit চাপে, ঠিক সেখানেই কারণটা দেখতে পায়,
            scrollIntoView কোনো কারণে ব্যর্থ হলেও। */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={isSubmitting || images.some(img => img.status === "uploading") || video?.status === "processing" || video?.status === "uploading"} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl text-sm shadow-sm hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
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

      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-800 text-center mb-4">
              {language === "bn" ? "এটা কী ধরনের বিজ্ঞাপন?" : "What kind of listing is this?"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => submitListing("vehicle")}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-gray-200 px-3 py-3.5 flex flex-col items-center gap-1.5 hover:border-amber-500 hover:bg-amber-50 transition-all disabled:opacity-50"
              >
                <img src={vehicleCardImg} alt="" className="w-full h-14 object-contain" />
                <span className="text-xs font-bold text-center leading-tight text-gray-600">
                  {language === "bn" ? "গাড়ি বেচা/কেনা" : "Vehicle Buy & Sell"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => submitListing("part")}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-gray-200 px-3 py-3.5 flex flex-col items-center gap-1.5 hover:border-sky-500 hover:bg-sky-50 transition-all disabled:opacity-50"
              >
                <img src={partsCardImg} alt="" className="w-full h-14 object-contain" />
                <span className="text-xs font-bold text-center leading-tight text-gray-600">
                  {language === "bn" ? "গাড়ির পাট" : "Vehicle Parts"}
                </span>
              </button>
            </div>
            {isSubmitting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === "bn" ? "পোস্ট হচ্ছে..." : "Posting..."}</span>
              </div>
            )}
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="mt-4 w-full text-center text-xs text-gray-400"
              >
                {language === "bn" ? "বাতিল করুন" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
