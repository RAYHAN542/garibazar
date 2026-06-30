import React, { useState, useRef, useEffect } from "react";
import { SupportedLanguage, PartListing } from "../types";
import { Camera, Sparkles, Loader2, ArrowRight, Check, AlertTriangle, Eye, ShoppingBag, User, X, Clock, RotateCw } from "lucide-react";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db, storage, auth } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { sanitizeText, validatePriceInput } from "../utils/sanitizer";

interface AddPartFormProps {
  language: SupportedLanguage;
  currentUser: any;
  onPostSuccess: () => void;
  onLoginPrompt: () => void;
  onViewListing?: (listing: any) => void;
}

const PRESET_GEARS = [
  { name: "Alloy Wheel Rims (অ্যালয় হুইল রিম)", url: "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=500&auto=format&fit=crop&q=80" },
  { name: "Turbocharger Assembly (টার্বোচার্জার)", url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80" },
  { name: "Steering Wheel Accent (স্টিয়ারিং হুইল)", url: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=500&auto=format&fit=crop&q=80" },
  { name: "Premium Brake Discs (ব্রেক ডিস্ক)", url: "https://images.unsplash.com/photo-1621360841013-c7683c659ec6?w=500&auto=format&fit=crop&q=80" }
];

const compressImageToBlob = async (file: File, maxWidth = 1200, maxHeight = 1200): Promise<{ blob: Blob; dataUrl: string }> => {
  try {
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");

    let sourceImg: ImageBitmap | HTMLImageElement;
    let width: number;
    let height: number;

    if (isHeic && typeof createImageBitmap !== "undefined") {
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
    if (!ctx) {
      throw new Error("Canvas context is null");
    }
    
    ctx.drawImage(sourceImg, 0, 0, width, height);

    if (typeof (sourceImg as ImageBitmap).close === "function") {
      (sourceImg as ImageBitmap).close();
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (!b) reject(new Error("Failed to convert canvas to Blob"));
        else resolve(b);
      }, "image/jpeg", 0.75);
    });

    return { blob, dataUrl };
  } catch (err) {
    throw err;
  }
};

export function AddPartForm({ language, currentUser, onPostSuccess, onLoginPrompt, onViewListing }: AddPartFormProps) {
  // Part & Vehicle Specific states
  const [postType, setPostType] = useState<'spare_parts' | 'vehicles'>('spare_parts');
  const [subCategory, setSubCategory] = useState("excavator");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadTasks, setUploadTasks] = useState<{ id: string, name: string, status: 'compressing' | 'uploading' | 'retrying' | 'error' | 'success', url?: string }[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

  const handleGenerateWithAi = async () => {
    if (!title.trim()) {
      setError(language === "bn" ? "এআই-এর মাধ্যমে বিবরণ তৈরির জন্য আগে একটি টাইটেল দিন।" : "Please enter a title before generating with AI.");
      return;
    }
    
    setGeneratingAi(true);
    setError("");
    
    try {
      const user = auth.currentUser;
      if (!user) {
        setError(language === "bn" ? "দয়া করে প্রথমে লগইন করুন।" : "Please log in first.");
        return;
      }
      
      const idToken = await user.getIdToken();
      const response = await fetch("/api/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          title,
          price,
          category: postType === "vehicles" ? "vehicles" : "spare_parts",
          language: language
        })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.description) {
        setDescription(data.description);
      } else {
        throw new Error("No description generated.");
      }
    } catch (err: any) {
      console.error("AI Generation error:", err);
      setError(language === "bn" 
        ? `এআই বিবরণ তৈরি করতে ব্যর্থ হয়েছে: ${err.message}` 
        : `AI Generation failed: ${err.message}`
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  // Status states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [allListings, setAllListings] = useState<PartListing[]>([]);
  const [localSavedIds, setLocalSavedIds] = useState<string[]>([]);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const handleRenew = async (id: string) => {
    try {
      setRenewingId(id);
      const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, "listings", id), {
        expiresAt: newExpiry
      });
    } catch (err) {
      console.error("Failed to renew listing:", err);
    } finally {
      setRenewingId(null);
    }
  };

  // Ref for main upload input
  const partFileInputRef = useRef<HTMLInputElement>(null);

  // Load local listings history
  useEffect(() => {
    const savedIdsStr = localStorage.getItem("gari_bazar_my_parts") || "[]";
    try {
      setLocalSavedIds(JSON.parse(savedIdsStr));
    } catch (e) {
      console.error("Local listed parts parsing error:", e);
    }
  }, []);

  // Real-time listener for current added parts tracking
  useEffect(() => {
    const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: PartListing[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PartListing);
      });
      setAllListings(list);
    }, (err) => {
      console.error("Firestore loading for Added Parts: ", err);
    });

    return () => unsubscribe();
  }, []);

  // Filter listings based on current signed in user ID or stored local listing IDs
  const myAddedListings = allListings.filter((item) => {
    const hasMatchId = localSavedIds.includes(item.id);
    const hasUserIdMatch = currentUser?.uid && item.sellerId === currentUser.uid;
    const hasContactMatch = currentUser?.phoneNumber && item.contactNumber === currentUser.phoneNumber;
    return hasMatchId || hasUserIdMatch || hasContactMatch;
  });

  const handlePartPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingLimit = 5 - images.length;
      if (remainingLimit <= 0) {
        setError(language === "bn" ? "সর্বোচ্চ ৫টি ছবি যুক্ত করা যাবে" : "Maximum 5 images can be added");
        return;
      }
      
      setCompressing(true);
      setError("");
      
      const filesArray = Array.from(files).slice(0, remainingLimit) as File[];
      
      const newTasks = filesArray.map(f => ({
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        status: 'compressing' as const
      }));
      setUploadTasks(prev => [...prev, ...newTasks]);

      const withTimeout = async <T,>(promise: Promise<T>, ms = 30000, fallbackName = "Operation"): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${fallbackName} timed out after ${ms}ms`)), ms))
        ]);
      };

      try {
        for (let i = 0; i < filesArray.length; i++) {
          const file = filesArray[i];
          const taskId = newTasks[i].id;

          const updateTask = (status: 'compressing' | 'uploading' | 'retrying' | 'error' | 'success', url?: string) => {
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, url } : t));
          };

          // Check format (more relaxed check to support direct mobile camera capture and iOS HEIC)
          const fileType = file.type ? file.type.toLowerCase() : "";
          const fileName = file.name ? file.name.toLowerCase() : "";
          const isAllowedType = 
            fileType.startsWith("image/") || 
            fileType === "application/octet-stream" ||
            fileName.endsWith(".jpg") || 
            fileName.endsWith(".jpeg") || 
            fileName.endsWith(".png") || 
            fileName.endsWith(".webp") ||
            fileName.endsWith(".heic") ||
            fileName.endsWith(".heif") ||
            fileName.includes("image");

          if (!isAllowedType) {
            setError(
              language === "bn" 
                ? "দয়া করে শুধুমাত্র ছবি আপলোড করুন।" 
                : "Please upload only image files."
            );
            updateTask('error');
            continue;
          }

          // Check original file size limit - set high (35MB) to support high-resolution mobile camera captures
          const MAX_ORIG_SIZE_BYTES = 35 * 1024 * 1024; // 35MB
          if (file.size > MAX_ORIG_SIZE_BYTES) {
            setError(
              language === "bn" 
                ? "ছবির সাইজ ৩৫ মেগাবাইটের বেশি হতে পারবে না।" 
                : "Image size must be under 35MB."
            );
            updateTask('error');
            continue;
          }

          let blobToUpload: Blob = file;

          try {
            // Client-side auto compress
            const compressed = await compressImageToBlob(file);
            blobToUpload = compressed.blob;
          } catch (compressErr) {
            console.log("Compression skipped or failed (possibly HEIC/unsupported format), using original file:", compressErr);
            blobToUpload = file;
          }

          // Verify size is within 9MB (under Firebase storage rules limit)
          const MAX_SIZE_BYTES = 9 * 1024 * 1024; // 9MB
          if (blobToUpload.size > MAX_SIZE_BYTES) {
            setError(
              language === "bn" 
                ? "ছবির সাইজ ৯ মেগাবাইটের বেশি হতে পারবে মহাশয়।" 
                : "Image size exceeds 9MB limit."
            );
            updateTask('error');
            continue;
          }

          updateTask('uploading');

          let attempts = 0;
          let success = false;
          let downloadUrl = "";
          
          while (attempts < 2 && !success) {
            attempts++;
            if (attempts > 1) updateTask('retrying');
            
            try {
              const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
              const storageRef = ref(storage, `listings/${uniqueName}`);
              
              await withTimeout(uploadBytes(storageRef, blobToUpload), 30000, "Image upload");
              downloadUrl = await withTimeout(getDownloadURL(storageRef), 15000, "Image URL fetch");
              success = true;
            } catch (err) {
              console.warn(`Attempt ${attempts} failed for ${file.name}:`, err);
            }
          }

          if (success) {
            updateTask('success', downloadUrl);
            setImages(prev => {
              const combined = [...prev, downloadUrl];
              return combined.slice(0, 5);
            });
          } else {
            updateTask('error');
            setError(language === "bn" ? `"${file.name}" আপলোড ব্যর্থ হয়েছে` : `Upload failed for "${file.name}"`);
          }
        }
      } catch (err: any) {
        console.error("Failed to compress or upload image:", err);
        setError(
          language === "bn" 
            ? "ছবি আপলোড বা প্রসেস করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।" 
            : "Failed to process or upload selected image files."
        );
      } finally {
        setCompressing(false);
        if (partFileInputRef.current) {
          partFileInputRef.current.value = "";
        }
      }
    }
  };

  const handlePostListing = async (e: React.FormEvent) => {
    e.preventDefault();

if (!currentUser) {
      const stored = localStorage.getItem("gari_bazar_session_user");
      if (!stored) {
        onLoginPrompt();
        return;
      }
    }
    if (!title.trim() || !price.trim()) {
      setError(language === "bn" ? "দয়া করে প্রয়োজনীয় সব তথ্য প্রদান করুন" : "Please fill in all mandatory parameters");
      return;
    }

    setLoading(true);
    setError("");

    // Fallback preset if they haven't uploaded an image
    const finalImages = images.length > 0 ? images : ["https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=500&auto=format&fit=crop&q=80"];
    const finalImage = finalImages[0];

    const sanitizedTitle = sanitizeText(title.trim(), 100);
    const sanitizedBrand = sanitizeText(brand.trim(), 100);
    const sanitizedModel = sanitizeText(model.trim(), 100);
    const validatedPrice = validatePriceInput(price);
    const defaultDesc = postType === "vehicles"
      ? (language === "bn"
        ? `উন্নত মানের গাড়ি/ভারী যন্ত্রপাতি সম্পূর্ণ কার্যক্ষম কন্ডিশনে বিক্রয় করা হবে।`
        : `High-quality vehicle/heavy machinery in fully operational condition.`)
      : (language === "bn"
        ? `জেনুইন কার পার্টস, সম্পূর্ণ সচল কন্ডিশন।`
        : `Genuine car part in absolute good condition.`);
    const sanitizedDesc = sanitizeText(description.trim() || defaultDesc, 1000);

    const formDocData = {
      title: sanitizedTitle,
      category: postType === "vehicles" ? "vehicles" : "spare_parts",
      subCategory: subCategory,
      brand: sanitizedBrand,
      model: sanitizedModel,
      price: validatedPrice,
      description: sanitizedDesc,
      contactNumber: sanitizeText(currentUser.phoneNumber || "01700000000", 25),
      sellerName: sanitizeText(currentUser.displayName || "Gari Bazar Seller", 100),
      sellerPhoto: currentUser.photoURL || "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=150&auto=format&fit=crop&q=80",
      location: sanitizeText(currentUser.city || "Dhaka (ঢাকা)", 100),
      image: finalImage,
      images: finalImages,
      hasVideo: false,
      views: 0,
      clicks: 0,
      isAd: false,
      adTier: "free",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      sellerId: currentUser.uid || "unregistered"
    };

    try {
      const addDocWithTimeout = () => {
        return new Promise<any>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Firebase write took too long. Saved to draft!"));
          }, 5500);

          addDoc(collection(db, "listings"), formDocData)
            .then((docRef) => {
              clearTimeout(timeoutId);
              resolve(docRef);
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
      };

      let docId = "";
      try {
        const docRef = await addDocWithTimeout();
        docId = docRef.id;
      } catch (writeErr) {
        console.warn("Firestore save deferred/offline, committing to LocalStorage fallback catalog:", writeErr);
        // Commit to offline listings cache
        const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
        let localListings: any[] = [];
        try {
          localListings = JSON.parse(localListingsStr);
        } catch (e) {}

        docId = `local-${Date.now()}`;
        localListings.push({ id: docId, ...formDocData });
        localStorage.setItem("gari_bazar_local_listings", JSON.stringify(localListings));
      }

      // Save listing id locally so the seller can manage it even on session load
      const updatedLocalIds = [...localSavedIds, docId];
      setLocalSavedIds(updatedLocalIds);
      localStorage.setItem("gari_bazar_my_parts", JSON.stringify(updatedLocalIds));

      setSuccess(true);
      setTitle("");
      setCategory("general");
      setSubCategory("excavator");
      setDescription("");
      setBrand("");
      setModel("");
      setPrice("");
      setImages([]);

      // Clean success message after 3.5s
      setTimeout(() => {
        setSuccess(false);
        onPostSuccess();
        // Dispatch custom global event to refresh listings context instantly
        window.dispatchEvent(new CustomEvent("gari_bazar_refreshed_data"));
      }, 3500);

    } catch (err: any) {
      console.error("Failed to post parts listing:", err);
      setError(language === "bn" 
        ? "বিজ্ঞাপনটি পোস্ট করতে ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।" 
        : "Failed to publish listing. Please check Firestore connection & try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-7 border border-slate-150/80 dark:border-slate-800 shadow-xl relative overflow-hidden transition duration-300">
      
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-slate-150 dark:border-slate-800">
        <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
          {postType === 'vehicles'
            ? (language === 'bn' ? 'গাড়ি ও ভারী যন্ত্রপাতি বিক্রি করুন' : 'Sell Vehicles & Heavy Machinery')
            : (language === 'bn' ? 'গাড়ির কার পার্টস বিক্রি করুন' : 'Sell Genuine Car Parts')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
          {postType === 'vehicles'
            ? (language === 'bn' ? 'আপনার ভারী যন্ত্রপাতি বা গাড়ি ক্রেতাদের কাছে পৌঁছে দিতে বিজ্ঞাপন দিন।' : 'Publish specifications for heavy equipment, excavators, loaders, cars, buses etc.')
            : (language === 'bn' ? 'কোনো বিজ্ঞাপন ফি ছাড়াই আজই পোস্ট করুন।' : 'Introduce your spare engine cores, gears, or accessories directly to local mechanics completely free.')}
        </p>
      </div>

      {/* Dual Post Type Selector Toggle */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 mb-6 border border-slate-200/30 dark:border-slate-850/30">
        <button
          type="button"
          onClick={() => {
            setPostType('spare_parts');
            setError("");
          }}
          className={`flex-1 py-3 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
            postType === 'spare_parts'
              ? "bg-white dark:bg-slate-900 text-amber-500 shadow-sm font-black border border-slate-205/40 dark:border-slate-800"
              : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-350"
          }`}
        >
          🔩 {language === "bn" ? "কার পার্টস কেনা/বেচা" : "Genuine Spare Parts"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPostType('vehicles');
            setError("");
          }}
          className={`flex-1 py-3 text-center text-xs font-black rounded-lg transition-all duration-200 cursor-pointer ${
            postType === 'vehicles'
              ? "bg-white dark:bg-slate-900 text-amber-500 shadow-sm font-black border border-slate-205/40 dark:border-slate-800"
              : "text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-350"
          }`}
        >
          🚜 {language === "bn" ? "গাড়ি ও হেভি ইকুইপমেন্ট" : "Vehicles & Heavy Equipment"}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 mt-6">
        <div className="lg:col-span-7">
          {!currentUser ? (
        /* Locked profile prompt */
        <div className="py-14 px-4 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-5">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-550">
            <User className="w-6 h-6" />
          </div>
          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {language === "bn" ? "প্রথমে বিক্রেতার প্রোফাইল সেটআপ করুন" : "Set Up Seller Profile First"}
            </h3>
            <p className="text-xs text-slate-505 dark:text-slate-400 leading-normal">
              {language === "bn"
                ? "কোনো পাসওয়ার্ড বা জিমেইলের ঝামেলা ছাড়াই শুধু মোবাইল নাম্বার দিয়ে ১ মিনিটে অ্যাকাউন্ট খুলুন এবং পার্টস বিক্রি করা শুরু করুন।"
                : "No passwords or email setup required. Create custom profile with just name & phone number to post ad."}
            </p>
          </div>
          <button
            type="button"
            onClick={onLoginPrompt}
            className="mx-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-600 hover:to-orange-600 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>{language === "bn" ? "প্রোফাইল নিশ্চিত করুন ও লগইন" : "Confirm Profile & Login"}</span>
          </button>
        </div>
      ) : (
        /* Actual simple post form */
        <>
              {success && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>
                    {language === "bn" 
                      ? "সফলভাবে পোস্ট হয়েছে! ক্রেতারা এখন বাজারের তালিকায় দেখতে পাবে।" 
                      : "Listing successfully published! Buyers can view your parts in the marketplace."}
                  </span>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handlePostListing} className="space-y-6">
                
                {/* Visual Section Header */}
                <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-850 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <img src={currentUser.photoURL} alt="" className="w-6 h-6 rounded-full object-cover border" />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {language === "bn" ? `বিক্রেতা: ${currentUser.displayName}` : `Seller: ${currentUser.displayName}`}
                    </span>
                    <span className="text-slate-350 dark:text-slate-600">•</span>
                    <span className="font-semibold text-slate-500">{currentUser.phoneNumber}</span>
                  </div>
                  <div className="flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-full border border-emerald-200/40 dark:border-emerald-800/20 shrink-0">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-850 space-y-6">
                  
                  {/* Part photos & Videos */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2 font-sans">
                      {postType === "vehicles"
                        ? (language === "bn" ? "১. গাড়ি বা যন্ত্রপাতির ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Vehicle & Machinery Photos (Upload up to 5 pictures) *")
                        : (language === "bn" ? "১. পার্টস এর ছবি (সর্বোচ্চ ৫টি পিক অ্যাড করুন) *" : "1. Spare Part Photos (Upload up to 5 pictures) *")
                      }
                    </label>

                    {/* Image grid */}
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
                      {images.map((imgSrc, idx) => (
                        <div 
                          key={idx} 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', idx.toString());
                            e.currentTarget.style.opacity = '0.5';
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                            const toIdx = idx;
                            if (fromIdx !== toIdx) {
                              setImages(prev => {
                                const newImages = [...prev];
                                const [moved] = newImages.splice(fromIdx, 1);
                                newImages.splice(toIdx, 0, moved);
                                return newImages;
                              });
                            }
                          }}
                          className="relative aspect-square w-full rounded-xl overflow-hidden border border-slate-250 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 group cursor-move"
                        >
                          <img src={imgSrc} alt="uploaded part" className="w-full h-full object-cover" />
                          
                          {/* Badge for main photo */}
                          {idx === 0 && (
                            <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
                              {language === "bn" ? "প্রধান" : "Main"}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow-md cursor-pointer z-10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {uploadTasks.filter(t => t.status !== 'success').map((task) => (
                        <div key={task.id} className="relative aspect-square w-full rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-2 text-center">
                          {task.status === 'error' ? (
                            <>
                              <AlertTriangle className="w-5 h-5 text-red-500 mb-1" />
                              <span className="text-[9px] font-bold text-red-500 leading-tight">
                                {language === "bn" ? "ব্যর্থ হয়েছে" : "Failed"}
                              </span>
                            </>
                          ) : (
                            <>
                              {task.status === 'retrying' ? (
                                <RotateCw className="w-5 h-5 animate-spin text-orange-500 mb-1" />
                              ) : (
                                <Loader2 className="w-5 h-5 animate-spin text-amber-500 mb-1" />
                              )}
                              <span className="text-[9px] font-bold text-slate-500 leading-tight">
                                {task.status === 'compressing' && (language === "bn" ? "প্রসেসিং..." : "Compressing...")}
                                {task.status === 'uploading' && (language === "bn" ? "আপলোড হচ্ছে..." : "Uploading...")}
                                {task.status === 'retrying' && (language === "bn" ? "পুনরায় চেষ্টা..." : "Retrying...")}
                              </span>
                            </>
                          )}
                        </div>
                      ))}

                      {images.length + uploadTasks.filter(t => t.status !== 'success' && t.status !== 'error').length < 5 && (
                        <div 
                          onClick={() => partFileInputRef.current?.click()}
                          className={`cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl aspect-square flex flex-col items-center justify-center bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-center min-h-[90px]`}
                        >
                           <Camera className="w-5 h-5 text-slate-400 mb-1" />
                           <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">
                             {language === "bn" ? `পিক অ্যাড করুন (${images.length}/5)` : `Add Photo (${images.length}/5)`}
                           </span>
                        </div>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={partFileInputRef}
                      onChange={handlePartPhotoUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                  </div>

                  {/* Part Details Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        {postType === "vehicles"
                          ? (language === "bn" ? "২. লিস্টিং টাইটেল (যেমন: গাড়ি/যন্ত্রপাতির নাম) *" : "2. Vehicle / Equipment Title *")
                          : (language === "bn" ? "২. পার্টের নাম / টাইটেল *" : "2. Spare Part Name / Title *")}
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                          postType === "vehicles"
                            ? (language === "bn" ? "যেমন: টয়োটা এক্সিও, ক্যাটারপিলার ৩২০ডি এক্সকাভেটর" : "e.g. Caterpillar 320D Excavator, Toyota Noah GL")
                            : (language === "bn" ? "যেমন: সিলিন্ডার হেড, টিউনিং স্পয়লার" : "e.g. Alloy Wheel Rims, Steering Wheel, Turbocharger")
                        }
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none mb-4"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        {language === "bn" ? "৩. ক্যাটাগরি সিলেক্ট করুন *" : "3. Select Category *"}
                      </label>
                      <select
                        value={subCategory}
                        onChange={(e) => setSubCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                      >
                        {postType === "vehicles" ? (
                          <>
                            <option value="excavator">{language === "bn" ? "এক্সক্যাভেটর (Excavator)" : "Excavator"}</option>
                            <option value="crane">{language === "bn" ? "ক্রেন (Crane)" : "Crane"}</option>
                            <option value="car">{language === "bn" ? "কার (Car)" : "Car"}</option>
                            <option value="bus">{language === "bn" ? "বাস (Bus)" : "Bus"}</option>
                            <option value="bulldozer">{language === "bn" ? "বুলডোজার (Bulldozer)" : "Bulldozer"}</option>
                            <option value="forklift">{language === "bn" ? "ফর্কলিফ্ট (Forklift)" : "Forklift"}</option>
                            <option value="other_heavy_equipment">{language === "bn" ? "অন্যান্য ভারী যন্ত্রপাতি (Other Heavy Equipment)" : "Other Heavy Equipment"}</option>
                          </>
                        ) : (
                          <>
                            <option value="engine_part">{language === "bn" ? "ইঞ্জিন পার্ট (Engine Part)" : "Engine Part"}</option>
                            <option value="light">{language === "bn" ? "লাইট (Light)" : "Light"}</option>
                            <option value="pump">{language === "bn" ? "পাম্প (Pump)" : "Pump"}</option>
                            <option value="controller">{language === "bn" ? "কন্ট্রোলার (Controller)" : "Controller"}</option>
                            <option value="drive_motor">{language === "bn" ? "ড্রাইভ মোটর (Drive Motor)" : "Drive Motor"}</option>
                            <option value="other_part">{language === "bn" ? "অন্যান্য পার্টস (Other Part)" : "Other Part"}</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        {language === "bn" ? "ব্র্যান্ড (Brand) - ঐচ্ছিক" : "Brand (Optional)"}
                      </label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder={language === "bn" ? "যেমন: Toyota, Caterpillar" : "e.g. Toyota, Caterpillar"}
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none mb-4"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        {language === "bn" ? "মডেল (Model) - ঐচ্ছিক" : "Model (Optional)"}
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={language === "bn" ? "যেমন: Corolla, 320D" : "e.g. Corolla, 320D"}
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none mb-4"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        {postType === "vehicles"
                          ? (language === "bn" ? "৪. গাড়ি বা যন্ত্রপাতির দাম (টাকা) *" : "4. Price (BDT / ৳) *")
                          : (language === "bn" ? "৪. পার্টস এর দাম (টাকা) *" : "4. Spare Parts Price (BDT / ৳) *")}
                      </label>
                      <input
                        type="number"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g. 5500"
                        className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-900 dark:text-white font-mono font-bold placeholder:text-slate-400 focus:outline-none font-sans"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-sans">
                          {language === "bn" ? "৫. বিবরণ (Description) *" : "5. Description *"}
                        </label>
                        <button
                          type="button"
                          disabled={generatingAi || !title.trim()}
                          onClick={handleGenerateWithAi}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold rounded-md text-[10px] flex items-center gap-1 transition cursor-pointer"
                        >
                          {generatingAi ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-slate-950" />
                              <span>{language === "bn" ? "তৈরি হচ্ছে..." : "Generating..."}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-slate-950" />
                              <span>{language === "bn" ? "AI দিয়ে বিবরণ তৈরি করুন" : "Generate with AI"}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={
                          postType === "vehicles"
                            ? (language === "bn"
                              ? "আপনার গাড়ি বা যন্ত্রপাতির অবস্থা বা লিস্টিং এর বিবরণ বিস্তারিত লিখুন..."
                              : "Provide vehicle or equipment listing description details...")
                            : (language === "bn"
                              ? "আপনার পার্টস এর অবস্থা বা লিস্টিং এর বিবরণ বিস্তারিত লিখুন..."
                              : "Provide spare parts listing description details...")
                        }
                        rows={4}
                        className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none font-sans leading-relaxed"
                      />
                    </div>
                  </div>

                </div>

                {/* Submission triggers */}
                <div className="flex justify-center pt-4 pb-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-10 py-4.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-600 hover:to-orange-600 font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <span>
                          {postType === "vehicles"
                            ? (language === "bn" ? "বিজ্ঞপ্তিটি প্রকাশ করুন (গাড়ি পোস্ট করুন)" : "Publish Vehicle Advert")
                            : (language === "bn" ? "বিজ্ঞপ্তিটি প্রকাশ করুন (পার্ট পোস্ট করুন)" : "Publish Spare Parts Advert")
                          }
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: LIST OF ADDED PARTS (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 shadow-md shadow-slate-950/20">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <ShoppingBag className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-black tracking-tight font-sans">
                  {language === "bn" ? "আপনার অ্যাড করা লিস্টিং সমূহ" : "Your Added Listings"}
                </h3>
              </div>
            </div>

            {myAddedListings.length === 0 ? (
              <div className="py-12 text-center text-slate-550 font-sans space-y-3">
                <div className="w-12 h-12 bg-slate-850 rounded-full flex items-center justify-center mx-auto text-slate-500 text-lg">
                  📦
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-350">
                    {language === "bn" ? "কোন লিস্টিং যুক্ত করা হয়নি!" : "No added listings tracked yet!"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {myAddedListings.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3.5 bg-slate-850/60 hover:bg-slate-850 border border-slate-800/80 rounded-xl flex gap-3.5 items-center justify-between transition-all duration-250"
                  >
                    <div className="flex gap-3 items-center min-w-0 font-sans">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700/50">
                        <img src={item.image} alt="" className="w-full h-full object-cover" />
                        {item.hasVideo && (
                          <span className="absolute bottom-1 right-1 bg-amber-500 text-slate-950 font-black text-[7px] px-1 rounded">
                            VIDEO
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-white truncate max-w-[150px] sm:max-w-[180px]">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 block font-semibold truncate mt-0.5">
                          🚗 {item.model}
                        </span>
                        <div className="flex gap-2 items-center text-[10px] font-bold text-amber-500 mt-1">
                          <span>৳{item.price.toLocaleString("en-IN")}</span>
                          <span className="text-slate-650">•</span>
                          <span className="text-slate-400 font-semibold">👁️ {item.views || 0} views</span>
                        </div>
                        {item.expiresAt && (() => {
                          const daysLeft = Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                          if (daysLeft <= 5 && daysLeft > 0) {
                            return (
                              <div className="text-[9px] text-red-400 font-bold mt-1 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {language === "bn" ? `মেয়াদ শেষ হতে ${daysLeft} দিন বাকি` : `Expiring in ${daysLeft} days`}
                              </div>
                            );
                          } else if (daysLeft <= 0) {
                            return (
                              <div className="text-[9px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {language === "bn" ? "মেয়াদোত্তীর্ণ" : "Expired"}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewListing?.(item)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10.5px] px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer justify-center"
                      >
                        <Eye className="w-3 h-3 text-slate-950" />
                        <span>{language === "bn" ? "দেখুন" : "View"}</span>
                      </button>
                      {item.expiresAt && Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 5 && (
                        <button
                          type="button"
                          onClick={() => handleRenew(item.id)}
                          disabled={renewingId === item.id}
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold text-[9px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 justify-center"
                        >
                          {renewingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCw className="w-3 h-3" />
                          )}
                          <span>{language === "bn" ? "রিনিউ" : "Renew"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
