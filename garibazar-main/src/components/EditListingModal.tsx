import React, { useState, useEffect } from "react";
import { SupportedLanguage, PartListing } from "../types";
import { X, Loader2, Save, AlertTriangle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { sanitizeText, validatePriceInput } from "../utils/sanitizer";

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

  useEffect(() => {
    if (listing) {
      setPrice(listing.price.toString());
      setModel(listing.model || "");
      setTitle(listing.title || "");
      setCategory(listing.category || "general");
      setDescription(listing.description || "");
      setLocation(listing.location || "");
      setError("");
    }
  }, [listing]);

  if (!isOpen || !listing) return null;

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
      
      const sanitizedTitle = sanitizeText(title.trim(), 100);
      const sanitizedModel = sanitizeText(model.trim(), 100);
      const validatedPrice = validatePriceInput(price);
      const sanitizedDesc = sanitizeText(description.trim(), 1000);
      const sanitizedLocation = sanitizeText(location.trim(), 100);

      const updatedData = {
        price: validatedPrice,
        model: sanitizedModel,
        title: sanitizedTitle,
        category: category,
        description: sanitizedDesc,
        location: sanitizedLocation,
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
        // Update Firebase
        const listingDocRef = doc(db, "listings", listing.id);
        await updateDoc(listingDocRef, updatedData);
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating listing:", err);
      setError(
        language === "bn"
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
              disabled={loading}
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
