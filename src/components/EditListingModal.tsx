import React, { useState, useEffect, useRef } from "react";
import { SupportedLanguage, PartListing } from "../types";
import { X, Loader2, Save, AlertTriangle, Video } from "lucide-react";
import { supabase } from "../supabase";
import { sanitizeText, validatePriceInput } from "../utils/sanitizer";
import { prepareVideo, uploadVideoToR2 } from "../utils/videoUpload";

interface EditListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: PartListing | null;
  language: SupportedLanguage;
  onSaveSuccess: () => void;
}

export function EditListingModal({
  isOpen,
  onClose,
  listing,
  language,
  onSaveSuccess,
}: EditListingModalProps) {
  const [price, setPrice] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoStage, setVideoStage] = useState<"prepare" | "upload">("prepare");
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (listing) {
      setPrice(listing.price.toString());
      setModel(listing.model || "");
      setTitle(listing.title || "");
      setCategory(listing.category || "general");
      setDescription(listing.description || "");
      setLocation(listing.location || "");
      setVideoUrl(listing.videoUrl || "");
      setVideoError("");
      setVideoBusy(false);
      setError("");
    }
  }, [listing]);

  if (!isOpen || !listing) return null;

  const handleVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setVideoError("");
    setVideoBusy(true);
    setVideoProgress(0);
    setVideoStage("prepare");
    try {
      // ২০ সেকেন্ডের বেশি হলে এখানেই প্রথম ২০ সেকেন্ড কেটে ছোট করা হয়
      const blob = await prepareVideo(file, (pct) => setVideoProgress(pct));
      setVideoStage("upload");
      setVideoProgress(0);
      const url = await uploadVideoToR2(blob, (pct) => setVideoProgress(pct));
      setVideoUrl(url);
    } catch (err: any) {
      setVideoError(err?.message || (language === "bn" ? "ভিডিও আপলোড হয়নি, আবার চেষ্টা করুন।" : "Video upload failed. Please try again."));
    } finally {
      setVideoBusy(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!price.trim() || !model.trim() || !title.trim() || !location.trim() || !description.trim()) {
      setError(
        language === "bn"
          ? "দয়া করে প্রয়োজনীয় সব তথ্য প্রদান করুন"
          : "Please specify title, price, model, location, and description"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const isLocal = listing.id.startsWith("local-") || listing.id.startsWith("temp-");
      
      const sanitizedTitle = sanitizeText(title.trim(), 199);
      const sanitizedModel = sanitizeText(model.trim(), 100);
      const validatedPrice = validatePriceInput(price);
      const sanitizedDesc = sanitizeText(description.trim(), 2999);
      const sanitizedLocation = sanitizeText(location.trim(), 100);

      const updatedData = {
        price: validatedPrice,
        model: sanitizedModel,
        title: sanitizedTitle,
        category: category,
        description: sanitizedDesc,
        location: sanitizedLocation,
        ...(videoUrl !== (listing.videoUrl || "")
          ? { video_url: videoUrl || null, has_video: !!videoUrl, is_video: !!videoUrl }
          : {}),
      };

      if (isLocal) {
        // Update local localStorage
        const localListingsStr = localStorage.getItem("gari_bazar_local_listings") || "[]";
        let localListings: any[] = [];
        try {
          localListings = JSON.parse(localListingsStr);
        } catch (e) {}

        const updated = localListings.map((item) =>
          item.id === listing.id ? { ...item, ...updatedData } : item
        );
        localStorage.setItem("gari_bazar_local_listings", JSON.stringify(updated));
      } else {
        // Migrated to Supabase (Phase 2 of the Firebase -> Supabase
        // migration). The listings_update_own_no_promote RLS policy plus
        // the protect_listing_admin_fields trigger together mean this call
        // can only ever change the plain fields sent here -- it's rejected
        // if the row isn't owned by the caller, and none of the fields
        // below (title/price/model/category/description/location) are
        // protected, so there's nothing extra to guard against here.
        const { error: updateError } = await supabase
          .from("listings")
          .update(updatedData)
          .eq("id", listing.id);
        if (updateError) throw updateError;
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating listing:", err);
      setError(
        err?.code === "42501" || err?.status === 403
          ? (language === "bn"
              ? "এই লিস্টিং সম্পাদনার অনুমতি নেই। অনুগ্রহ করে লগআউট করে আবার লগইন করুন।"
              : "You don't have permission to edit this listing. Please log out and log back in.")
          : err?.message && (err.message.includes("maximum length") || err.message.includes("invalid characters"))
          ? err.message
          : language === "bn"
          ? "সংরক্ষণ করতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।"
          : "Failed to save updates. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-550 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-150 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider font-sans">
            {((listing as any).type === "vehicle" || listing.category === "vehicles")
              ? (language === "bn" ? "গাড়ি ও ভারী যন্ত্রপাতি সম্পাদনা" : "Edit Vehicle Listing")
              : (language === "bn" ? "পার্ট লিস্ট সম্পাদনা" : "Edit Part Listing")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-955 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleUpdate} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 rounded-lg text-xs font-bold font-sans flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                {((listing as any).type === "vehicle" || listing.category === "vehicles")
                  ? (language === "bn" ? "গাড়ি/যন্ত্রপাতির নাম বা টাইটেল *" : "Vehicle / Equipment Title *")
                  : (language === "bn" ? "পার্ট লিস্টিং টাইটেল *" : "Part Listing Title *")}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. alloy wheels"
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  {language === "bn" ? "ক্যাটাগরি" : "Category"}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white font-bold focus:outline-none"
                >
                  {((listing as any).type === "vehicle" || listing.category === "vehicles") ? (
                    <option value="vehicles">{language === "bn" ? "গাড়ি ও হেভি ইকুইপমেন্ট" : "Vehicles & Equipment"}</option>
                  ) : (
                    <>
                      <option value="general">{language === "bn" ? "সাধারণ পার্টস (General)" : "General Parts"}</option>
                      <option value="engine">{language === "bn" ? "ইঞ্জিন পার্টস (Engine)" : "Engine & Transmission"}</option>
                      <option value="wheels">{language === "bn" ? "টায়ার ও হুইল (Wheels)" : "Tyres & Wheels"}</option>
                      <option value="interior">{language === "bn" ? "ইন্টেরিয়র পার্টস (Interior)" : "Interior Accessories"}</option>
                      <option value="exterior">{language === "bn" ? "এক্সটেরিয়র বডি (Exterior)" : "Exterior Body"}</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  {language === "bn" ? "লোকেশন *" : "Location *"}
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Dhaka (ঢাকা)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  {((listing as any).type === "vehicle" || listing.category === "vehicles")
                    ? (language === "bn" ? "দাম (টাকা) *" : "Price (BDT / ৳) *")
                    : (language === "bn" ? "কার পার্টস এর দাম (টাকা) *" : "Price (BDT / ৳) *")}
                </label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white font-mono font-bold placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              {!((listing as any).type === "vehicle" || listing.category === "vehicles") ? (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    {language === "bn" ? "গাড়ির মডেল কি *" : "Compatible Car Model *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Toyota Axio / Fielder"
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                {language === "bn" ? "বিবরণ (Description) *" : "Description *"}
              </label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe your part details..."
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Video */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {language === "bn" ? "ভিডিও (সর্বোচ্চ ২০ সেকেন্ড)" : "Video (max 20 seconds)"}
              </span>
              <button
                type="button"
                disabled={videoBusy || loading}
                onClick={() => videoInputRef.current?.click()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Video className="w-3.5 h-3.5" />
                <span>
                  {videoUrl
                    ? (language === "bn" ? "ভিডিও বদলান" : "Replace video")
                    : (language === "bn" ? "ভিডিও যোগ করুন" : "Add video")}
                </span>
              </button>
            </div>
            <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoPick} />
            {videoBusy && (
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {videoStage === "prepare"
                    ? (language === "bn" ? "ভিডিও তৈরি হচ্ছে… " : "Preparing video… ")
                    : (language === "bn" ? "আপলোড হচ্ছে… " : "Uploading… ")}
                  {videoProgress}%
                </span>
              </div>
            )}
            {videoError && <p className="text-[11px] font-bold text-red-500">{videoError}</p>}
            {videoUrl && !videoBusy && (
              <video src={videoUrl} controls playsInline preload="metadata" className="w-full max-h-44 rounded-lg bg-black" />
            )}
            {videoUrl !== (listing.videoUrl || "") && !videoBusy && (
              <p className="text-[11px] font-semibold text-slate-500">
                {language === "bn" ? "নতুন ভিডিও 'পরিবর্তন সংরক্ষণ করুন' চাপলে সেভ হবে।" : "The new video is saved when you press Save Changes."}
              </p>
            )}
          </div>

          {/* Actions footer */}
          <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-100 dark:border-slate-850 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              {language === "bn" ? "বাতিল" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={loading || videoBusy}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{language === "bn" ? "পরিবর্তন সংরক্ষণ করুন" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
