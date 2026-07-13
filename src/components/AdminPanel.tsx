import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc 
} from "firebase/firestore";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Coins, 
  Loader2, 
  Save, 
  Check, 
  Phone, 
  Smartphone, 
  ArrowRight, 
  User, 
  Clock, 
  Mail,
  Trash2,
  Search,
  TrendingUp,
  Grid,
  Inbox,
  Flag
} from "lucide-react";
import { SupportedLanguage } from "../types";

interface AdminPanelProps {
  language: SupportedLanguage;
  currentUser: any;
  listings: any[];
  isUserAdmin: boolean;
}

export function AdminPanel({ language, currentUser, listings: listingsProp, isUserAdmin }: AdminPanelProps) {
  // Local mirror of the listings prop so we can optimistically remove
  // deleted items instantly without waiting for a full page reload.
  const [listings, setListings] = useState<any[]>(listingsProp);
  useEffect(() => {
    setListings(listingsProp);
  }, [listingsProp]);

  // Enforce secure lock immediately
  if (!isUserAdmin) {
    return (
      <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-black text-slate-800 dark:text-red-400 uppercase tracking-wider font-sans">
          {language === "bn" ? "অননুমোদিত অ্যাক্সেস!" : "Unauthorized Access!"}
        </p>
        <p className="text-xs text-slate-500 mt-1 font-semibold">
          {language === "bn"
            ? "শুধুমাত্র অনুমোদিত এডমিন অ্যাকাউন্টসমূহ এই পৃষ্ঠাটি পরিচালনা করতে পারবে।"
            : "Only authorized admin accounts can manage this dashboard."}
        </p>
      </div>
    );
  }

  // Payment numbers form states
  const [bkash, setBkash] = useState("01783457173 (Personal)");
  const [nagad, setNagad] = useState("01783457173 (Personal)");
  const [rocket, setRocket] = useState("01783457173 (Personal)");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Refill requests states
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Sub-tabs for the Admin Panel itself to make it exceptionally organized and professional
  const [adminSubTab, setAdminSubTab] = useState<"requests" | "listings" | "settings" | "tickets">("requests");

  // Support tickets states
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [ticketActionLoadingId, setTicketActionLoadingId] = useState<string | null>(null);

  // Listings search and action states
  const [listingsSearch, setListingsSearch] = useState("");
  const [showOnlyReported, setShowOnlyReported] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleSeedMockListings = async () => {
    const confirmSeed = window.confirm(
      language === "bn"
        ? "আপনি কি নিশ্চিতভাবে ডাটাবেসে মক ডেটা যোগ করতে চান?"
        : "Are you sure you want to seed the database with sample mock listings?"
    );
    if (!confirmSeed) return;

    setSeeding(true);
    setActionSuccessMsg("");
    try {
      const { SAMPLE_LISTINGS } = await import("../translations");
      for (const item of SAMPLE_LISTINGS) {
        await setDoc(doc(db, "listings", item.id), item);
      }
      setActionSuccessMsg(
        language === "bn"
          ? "সফলভাবে ডাটাবেসে মক লিস্টিং যোগ করা হয়েছে! মার্কেটপ্লেস রিফ্রেশ করুন।"
          : "Successfully seeded mock listings in the database! Please refresh the marketplace."
      );
      window.dispatchEvent(new CustomEvent("gari_bazar_refreshed_data"));
    } catch (err: any) {
      console.error("Seeding error:", err);
      setActionSuccessMsg(`Failed to seed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // Load configured payment info from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "payment_info"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBkash(data.bkash || "01783457173 (Personal)");
        setNagad(data.nagad || "01783457173 (Personal)");
        setRocket(data.rocket || "01783457173 (Personal)");
      }
    });
    return () => unsub();
  }, []);

  // Listen to all refill requests across Gari Bazar platform
  useEffect(() => {
    const q = query(
      collection(db, "refill_requests"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRequests(list);
      setLoadingRequests(false);
    }, (err) => {
      console.error("Could not fetch refill requests:", err);
      setLoadingRequests(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to all customer support tickets across Gari Bazar platform
  useEffect(() => {
    const q = query(
      collection(db, "support_tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTicketsList(list);
      setLoadingTickets(false);
    }, (err) => {
      console.error("Could not fetch support tickets:", err);
      setLoadingTickets(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResolveTicket = async (ticketId: string) => {
    setTicketActionLoadingId(ticketId);
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status: "resolved",
        resolvedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Could not resolve ticket:", err);
    } finally {
      setTicketActionLoadingId(null);
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    setTicketActionLoadingId(ticketId);
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status: "open"
      });
    } catch (err) {
      console.error("Could not reopen ticket:", err);
    } finally {
      setTicketActionLoadingId(null);
    }
  };

  const handleUpdatePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);

    try {
      await setDoc(doc(db, "settings", "payment_info"), {
        bkash: bkash.trim(),
        nagad: nagad.trim(),
        rocket: rocket.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.phoneNumber || currentUser?.email || "Admin"
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error updating payment setup:", err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleApproveRequest = async (request: any) => {
    setActionLoadingId(request.id);
    setActionSuccessMsg("");

    try {
      // 1. Get current balance of target user
      const userRef = doc(db, "users", request.userId);
      const userSnap = await getDoc(userRef);
      
      let currentCredits = 5000; // default startup budget
      if (userSnap.exists()) {
        const data = userSnap.data();
        currentCredits = data.simulatedCredits ?? 5000;
      }

      // 2. Process based on request type
      if (request.type === "ad_promotion" && request.listingId) {
        // Automatically make the listing listing active and promoted with correct duration
        const listingRef = doc(db, "listings", request.listingId);
        const duration = Number(request.durationDays || 3);
        await updateDoc(listingRef, {
          isAd: true,
          adTier: request.adTier || "basic",
          adDurationDays: duration,
          adExpiresAt: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
        });
      } else {
        // Standard wallet balance refill request
        const newCredits = currentCredits + request.amount;
        await updateDoc(userRef, {
          simulatedCredits: newCredits
        });
      }

      // 3. Mark the refill request as approved
      await updateDoc(doc(db, "refill_requests", request.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        reviewedBy: currentUser?.phoneNumber || currentUser?.email || "Admin"
      });

      setActionSuccessMsg(
        language === "bn" 
          ? (request.type === "ad_promotion" 
              ? `সফলভাবে বিজ্ঞাপন প্রমোশন রিকোয়েস্ট অনুমোদিত হয়েছে!` 
              : `সফলভাবে ${request.userName}-এর ওয়ালেটে ৳${request.amount.toLocaleString()} যোগ করা হয়েছে!`) 
          : (request.type === "ad_promotion"
              ? `Ad promotion request successfully approved & listing promoted!`
              : `Successfully added ৳${request.amount.toLocaleString()} to ${request.userName}'s wallet!`)
      );
    } catch (err: any) {
      console.error("Failed to approve refill request:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectRequest = async (request: any) => {
    setActionLoadingId(request.id);
    setActionSuccessMsg("");

    try {
      await updateDoc(doc(db, "refill_requests", request.id), {
        status: "rejected",
        rejectedAt: new Date().toISOString(),
        reviewedBy: currentUser?.phoneNumber || currentUser?.email || "Admin"
      });

      setActionSuccessMsg(
        language === "bn" 
          ? "রিকোয়েস্ট বাতিল করা হয়েছে!" 
          : "Refill request rejected successfully!"
      );
    } catch (err: any) {
      console.error("Failed to reject refill request:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    const confirmDelete = window.confirm(
      language === "bn" 
        ? "আপনি কি নিশ্চিতভাবে এই লিস্টিংটি ডিলিট করতে চান?" 
        : "Are you sure you want to delete this listing permanently from the marketplace?"
    );
    if (!confirmDelete) return;

    setDeleteLoadingId(listingId);
    setActionSuccessMsg("");

    try {
      await deleteDoc(doc(db, "listings", listingId));
      // Remove instantly from the local list so the admin sees the
      // updated count/grid without needing to reload the page.
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      setActionSuccessMsg(
        language === "bn"
          ? "লিস্টিংটি সফলভাবে গেটওয়ে ও ডাটাবেস থেকে মুছে ফেলা হয়েছে!"
          : "Listing successfully removed from the marketplace database!"
      );
    } catch (err: any) {
      console.error("Error deleting listing:", err);
      setActionSuccessMsg(
        language === "bn"
          ? "লিস্টিং মুছে ফেলতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
          : "Failed to delete listing. Please try again."
      );
    } finally {
      setDeleteLoadingId(null);
    }
  };

  // Calculate stats
  const totalRevenue = requests
    .filter((req) => req.status === "approved")
    .reduce((sum, req) => sum + (Number(req.amount) || 0), 0);
  const totalListings = listings?.length || 0;
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      
      {/* Upper Panel Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 text-amber-500/5 select-none pointer-events-none">
          <ShieldAlert className="w-36 h-36" />
        </div>
        <div className="max-w-xl">
          <span className="text-red-500 text-xs font-black tracking-widest uppercase block mb-1">
            {language === "bn" ? "অ্যাডমিন প্যানেল (মালিক)" : "ADMIN CONTROL PANEL"}
          </span>
          <h4 className="text-lg font-black text-white font-sans tracking-tight">
            {language === "bn" ? "পেমেন্ট নম্বর ও রিচার্জ আবোদন কন্ট্রোল" : "Payment Numbers & Refill Controls"}
          </h4>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            {language === "bn"
              ? "আপনি এই অ্যাপের সম্মানিত মালিক। এখান থেকে ব্যবহারকারীদের পাঠানো টাকা চেক করে তাদের বাজেট ব্যালেন্স ভেরিফাই করুন।"
              : "As the official owner of this application, you can manage payment routes and authorize user balances safely."}
          </p>
        </div>
      </div>

      {/* Dynamic Admin Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Revenue card */}
        <div className="bg-emerald-500/5 dark:bg-emerald-500/[0.03] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-slate-450 dark:text-slate-400 uppercase block mb-1">
              {language === "bn" ? "মোট সর্বমোট রাজস্ব" : "TOTAL REVENUE (APPROVED)"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              ৳{totalRevenue.toLocaleString()}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Listings posts count */}
        <div className="bg-blue-500/5 dark:bg-blue-500/[0.03] border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-slate-455 dark:text-slate-400 uppercase block mb-1">
              {language === "bn" ? "মোট পার্টস লিস্টিং সংখ্যা" : "TOTAL MARKET LISTINGS"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">
              {totalListings}
            </span>
          </div>
          <div className="p-3 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-xl">
            <Grid className="w-5 h-5" />
          </div>
        </div>

        {/* Pending payment request verification cases */}
        <div className="bg-amber-500/5 dark:bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black tracking-widest text-slate-450 dark:text-slate-400 uppercase block mb-1">
              {language === "bn" ? "অপেক্ষমান পেমেন্ট রিকোয়েস্ট" : "PENDING VERIFICATIONS"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
              {pendingRequestsCount}
            </span>
          </div>
          <div className="p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl">
            <Inbox className="w-5 h-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Admin Panel Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 pt-1">
        <button
          onClick={() => setAdminSubTab("requests")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "requests"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? `পেমেন্ট রিকোয়েস্টস (${pendingRequestsCount})` : `Payment Requests (${pendingRequestsCount})`}
        </button>

        <button
          onClick={() => setAdminSubTab("listings")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "listings"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? `লিস্টিং কন্ট্রোল প্যানেল (${totalListings})` : `Manage Listings (${totalListings})`}
        </button>

        <button
          onClick={() => setAdminSubTab("settings")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "settings"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn" ? "আমার বিকাশ/নগদ/রকেট নম্বর" : "Edit Payment Numbers"}
        </button>

        <button
          onClick={() => setAdminSubTab("tickets")}
          className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            adminSubTab === "tickets"
              ? "border-amber-500 text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          {language === "bn"
            ? `সাপোর্ট টিকেট (${ticketsList.filter(t => t.status !== "resolved").length})`
            : `Support Tickets (${ticketsList.filter(t => t.status !== "resolved").length})`}
        </button>
      </div>

      {/* SUCCESS ALERTS */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold animate-fade-in flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setActionSuccessMsg("")}
            className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-slate-350"
          >
            {language === "bn" ? "বন্ধ করুন" : "Dismiss"}
          </button>
        </div>
      )}

      {/* PANEL CONTENTS */}
      {adminSubTab === "settings" ? (
        
        /* 1. EDIT WALLET ROUTE NUMBERS */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-xl">
          <h5 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-500" />
            {language === "bn" ? "আমার পার্সোনাল মোবাইল পেমেন্ট নাম্বার সেট করুন" : "Set Your Mobile Payment Receivers"}
          </h5>

          <form onSubmit={handleUpdatePaymentConfig} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {language === "bn" ? "বিকাশ নম্বর (bKash Number)" : "bKash Send Money Number"}
              </label>
              <input
                type="text"
                value={bkash}
                onChange={(e) => setBkash(e.target.value)}
                placeholder="e.g. 017XXXXXXXX (Personal)"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {language === "bn" ? "নগদ নম্বর (Nagad Number)" : "Nagad Send Money Number"}
              </label>
              <input
                type="text"
                value={nagad}
                onChange={(e) => setNagad(e.target.value)}
                placeholder="e.g. 017XXXXXXXX (Personal)"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {language === "bn" ? "রকেট নম্বর (Rocket Number)" : "Rocket Send Money Number"}
              </label>
              <input
                type="text"
                value={rocket}
                onChange={(e) => setRocket(e.target.value)}
                placeholder="e.g. 017XXXXXXXX (Personal)"
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                required
              />
            </div>

            {saveSuccess && (
              <p className="text-emerald-500 text-xs font-bold flex items-center gap-1.5 font-sans">
                <Check className="w-4 h-4" />
                {language === "bn" ? "মোবাইল নম্বরসমূহ সফলভাবে আপডেট করা হয়েছে!" : "Payment details saved successfully! All users will see these numbers."}
              </p>
            )}

            <button
              type="submit"
              disabled={saveLoading}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              {saveLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {language === "bn" ? "তথ্য সেভ করুন" : "Save Changes"}
                </>
              )}
            </button>
          </form>
        </div>

      ) : adminSubTab === "listings" ? (
        
        /* 2. MANAGE MARKETPLACE LISTINGS INVENTORY */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl">
            <div>
              <h5 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Grid className="w-5 h-5 text-red-500 animate-pulse" />
                {language === "bn" ? "মার্কেটপ্লেস লিস্টিং ম্যানেজমেন্ট" : "Active Marketplace Postings"}
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                {language === "bn" ? "যেকোনো পোস্ট মার্কেটপ্লেস থেকে সরাসরি মুছে ফেলে শৃঙ্খলা বজায় রাখুন।" : "Audit active posts on the hub. Delete any inappropriate listings or fraud attempts instantly."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Reported Filter Toggle */}
              <button
                type="button"
                onClick={() => setShowOnlyReported(!showOnlyReported)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  showOnlyReported
                    ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/20"
                    : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850"
                }`}
              >
                <Flag className={`w-3.5 h-3.5 ${showOnlyReported ? "text-red-500 animate-pulse" : "text-slate-450"}`} />
                <span>
                  {language === "bn" 
                    ? `অভিযোগ প্রাপ্ত বিজ্ঞাপন (${listings.filter(i => (i.reportCount || 0) > 0).length})` 
                    : `Reported Only (${listings.filter(i => (i.reportCount || 0) > 0).length})`}
                </span>
              </button>

              {/* Seed Database Action Button */}
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeedMockListings}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === "bn" ? "যোগ হচ্ছে..." : "Seeding..."}</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5" />
                    <span>{language === "bn" ? "মক লিস্টিং যোগ করুন" : "Seed Mock Listings"}</span>
                  </>
                )}
              </button>

              {/* Search Input Filter */}
              <div className="relative max-w-xs w-full shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={listingsSearch}
                  onChange={(e) => setListingsSearch(e.target.value)}
                  placeholder={language === "bn" ? "পার্টস বা আইডি দিয়ে খুঁজুন..." : "Search parts or advertiser..."}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/25 text-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Filtered Posts Grid */}
          {(() => {
            const queryClean = listingsSearch.toLowerCase().trim();
            let filtered = listings.filter(item => 
              item.title?.toLowerCase().includes(queryClean) ||
              item.category?.toLowerCase().includes(queryClean) ||
              item.location?.toLowerCase().includes(queryClean) ||
              item.sellerName?.toLowerCase().includes(queryClean) ||
              item.id?.toLowerCase().includes(queryClean)
            );

            if (showOnlyReported) {
              filtered = filtered.filter(item => (item.reportCount || 0) > 0 || (item.reportedBy && item.reportedBy.length > 0));
            }

            if (filtered.length === 0) {
              return (
                <div className="bg-slate-50 dark:bg-slate-950 border border-dashed rounded-2xl p-12 text-center text-slate-500">
                  <Search className="w-8 h-8 text-slate-350 mx-auto mb-2" />
                  <p className="text-xs font-medium">
                    {language === "bn" ? "কোন লিস্টিং পাওয়া যায় নি!" : "No active listings found matching your search query."}
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="admin-listings-grid">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between transition relative ${
                      (item.reportCount || 0) > 0
                        ? "border-red-500/50 shadow-[0_2px_10px_-1px_rgba(239,68,68,0.12)] bg-red-500/[0.005]"
                        : item.isAd 
                          ? "border-amber-400 shadow-[0_2px_8px_-1px_rgba(245,158,11,0.08)] bg-amber-500/[0.005]" 
                          : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Badge Alert for Promotions or Reports */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {item.isAd && (
                        <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm">
                          {item.adTier ? `${item.adTier} ad` : "Promoted"}
                        </span>
                      )}
                      {(item.reportCount || 0) > 0 && (
                        <span className="bg-red-650 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                          <Flag className="w-2.5 h-2.5" />
                          <span>
                            {language === "bn" ? `${item.reportCount}টি অভিযোগ` : `${item.reportCount} Reports`}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Listing Image Header + Overview */}
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3">
                        <img
                          src={
                            item.image ||
                            (item.images && item.images.length > 0 ? item.images[0] : "") ||
                            "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=200&auto=format&fit=crop&q=60"
                          }
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=200&auto=format&fit=crop&q=60";
                          }}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-250 dark:border-slate-800 bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            ID: <span className="select-all">{item.id}</span>
                          </p>
                          <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9px] text-slate-500 font-bold rounded">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      {/* Detail lines list */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-850 space-y-1 text-[11px] font-sans">
                        <div className="flex justify-between">
                          <span className="text-slate-400">{language === "bn" ? "মূল্য (৳):" : "Price:"}</span>
                          <span className="font-extrabold text-slate-700 dark:text-slate-200 font-mono">
                            ৳{item.price?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{language === "bn" ? "মডেল:" : "Model:"}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{item.model || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{language === "bn" ? "অবস্থান:" : "Location:"}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{language === "bn" ? "বিক্রেতা:" : "Seller:"}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-black">{item.sellerName} ({item.contactNumber})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{language === "bn" ? "ভিউ কাউন্টার:" : "Views:"}</span>
                          <span className="text-amber-550 dark:text-amber-400 font-bold font-mono">{item.views || 0} views</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Delete Button */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-850 flex items-center justify-end">
                      <button
                        onClick={() => handleDeleteListing(item.id)}
                        disabled={deleteLoadingId === item.id}
                        className="p-1.5 px-3 bg-red-610 hover:bg-red-700 text-red-500 hover:text-white bg-red-500/10 rounded-lg border border-red-500/20 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      >
                        {deleteLoadingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>{language === "bn" ? "ডিলিট করুন" : "Delete Post"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

      ) : adminSubTab === "tickets" ? (

        /* SUPPORT TICKETS PANEL */
        <div className="space-y-4">
          <h5 className="text-sm font-black text-slate-850 dark:text-white mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-500" />
            {language === "bn" ? "গ্রাহক সাপোর্ট টিকেট" : "Customer Support Tickets"}
          </h5>

          {loadingTickets ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            </div>
          ) : ticketsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center">
              <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-bold text-slate-500">
                {language === "bn" ? "এখনো কোনো সাপোর্ট টিকেট আসেনি।" : "No support tickets yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {ticketsList.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-black text-slate-800 dark:text-white">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {ticket.name || "Anonymous"}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            ticket.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {ticket.status === "resolved"
                            ? (language === "bn" ? "সমাধান হয়েছে" : "Resolved")
                            : (language === "bn" ? "খোলা" : "Open")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{ticket.email || "—"}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium mt-2 whitespace-pre-wrap">
                        {ticket.message}
                      </p>
                      {ticket.createdAt && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(ticket.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-US")}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {ticket.status === "resolved" ? (
                        <button
                          onClick={() => handleReopenTicket(ticket.id)}
                          disabled={ticketActionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-amber-500 hover:text-white bg-amber-500/10 hover:bg-amber-500 rounded-lg border border-amber-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {ticketActionLoadingId === ticket.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>{language === "bn" ? "আবার খুলুন" : "Reopen"}</span>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResolveTicket(ticket.id)}
                          disabled={ticketActionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 rounded-lg border border-emerald-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          {ticketActionLoadingId === ticket.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{language === "bn" ? "সমাধান হয়েছে" : "Resolve"}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (

        /* 2. REFILL PENDING LISTINGS CONTROL PANEL */
        <div className="space-y-4">
          <h5 className="text-sm font-black text-slate-850 dark:text-white mb-2 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            {language === "bn" ? "ব্যবহারকারীদের অপেক্ষমান রিচার্জ পেমেন্ট তালিকা" : "All Promotional Wallet Refill Applications"}
          </h5>

          {loadingRequests ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              <p className="text-xs text-slate-400">{language === "bn" ? "রিচার্য আবেদন লোড হচ্ছে..." : "Loading refill requests..."}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-950 border border-dashed rounded-2xl p-10 text-center text-slate-500">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-medium">{language === "bn" ? "কোনো রিচার্জের আবেদন পাওয়া যায়নি" : "No budget refill requests submitted yet."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="all-refill-requests">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between ${
                    req.status === "pending"
                      ? "border-amber-500/40 bg-amber-500/[0.015]"
                      : req.status === "approved"
                      ? "border-slate-200 dark:border-slate-800 opacity-80"
                      : "border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/30"
                  }`}
                >
                  {/* Status Indicator Band */}
                  <div className="absolute top-0 right-0">
                    {req.status === "pending" ? (
                      <span className="inline-block px-3 py-1 text-[8px] font-extrabold uppercase bg-amber-500 text-slate-950 font-sans rounded-bl-xl tracking-wider">
                        {language === "bn" ? "পেন্ডিং" : "Pending"}
                      </span>
                    ) : req.status === "approved" ? (
                      <span className="inline-block px-3 py-1 text-[8px] font-extrabold uppercase bg-emerald-500 text-white font-sans rounded-bl-xl tracking-wider">
                        {language === "bn" ? "অনুমোদিত" : "Approved"}
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 text-[8px] font-extrabold uppercase bg-red-500 text-white font-sans rounded-bl-xl tracking-wider">
                        {language === "bn" ? "বাতিল" : "Rejected"}
                      </span>
                    )}
                  </div>

                  {/* Top segment: User info */}
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h6 className="text-xs font-black text-slate-800 dark:text-white truncate">
                          {req.userName}
                        </h6>
                        <span className="text-[10px] text-slate-400 font-medium font-mono truncate block flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {req.userEmail}
                        </span>
                      </div>
                    </div>

                    {/* Money & Account numbers */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2 font-sans">
                      {req.type === "ad_promotion" ? (
                        <>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">
                              {language === "bn" ? "প্রোমোশন প্যাকেজ:" : "Promo Package:"}
                            </span>
                            <span className="font-extrabold text-amber-500 font-mono">
                              {req.packageName || (req.adTier === "featured" ? "Diamond Top Spot" : req.adTier === "premium" ? "Premium Slider" : "Basic Boost")}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px] border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                            <span className="text-slate-400">
                              {language === "bn" ? "পার্ট টাইটেল:" : "Listing Part:"}
                            </span>
                            <span className="font-black text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={req.listingTitle}>
                              {req.listingTitle || "Ad Listing"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">
                              {language === "bn" ? "মেয়াদকাল:" : "Ad Duration:"}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {req.durationDays || (req.adTier === "featured" ? 12 : req.adTier === "premium" ? 6 : 3)} Days
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">
                              {language === "bn" ? "পেমেন্ট প্রাপ্তি:" : "Amount paid:"}
                            </span>
                            <span className="font-extrabold text-emerald-500 font-mono">
                              ৳{req.amount?.toLocaleString() || "0"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px] border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                            <span className="text-slate-400">
                              {language === "bn" ? "রিসিভার বিকাশ নম্বর:" : "Receiver bKash No:"}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                              {req.myNumber || "01993878271"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{language === "bn" ? "অনুরোধকৃত বাজেট:" : "Requested Wallet:"}</span>
                            <span className="text-sm font-black text-amber-500 font-mono">৳{req.amount.toLocaleString()}</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800/50 pt-2 text-[11px]">
                            <span className="text-slate-400">
                              {language === "bn" ? "পদ্ধতি:" : "Channel:"}
                            </span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 uppercase shrink-0">
                              {req.method || "bKash"}
                            </span>
                          </div>
                        </>
                      )}

                      <div className="flex justify-between items-center text-[11px] border-t border-slate-200/40 dark:border-slate-800/40 pt-1.5">
                        <span className="text-slate-400">
                          {language === "bn" ? "প্রেরক বিকাশ নম্বর:" : "Sender No:"}
                        </span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono shrink-0">
                          {req.senderNumber}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">
                          TxID:
                        </span>
                        <span className="font-extrabold text-slate-850 dark:text-slate-200 font-mono select-all shrink-0 uppercase">
                          {req.txId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions segment */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between gap-2.5 mt-3">
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(req.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {req.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleRejectRequest(req)}
                          disabled={actionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded-lg border border-red-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          title={language === "bn" ? "বাতিল" : "Reject"}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{language === "bn" ? "বাতিল" : "Reject"}</span>
                        </button>
                        <button
                          onClick={() => handleApproveRequest(req)}
                          disabled={actionLoadingId !== null}
                          className="p-1 px-2.5 text-[10px] font-bold text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 rounded-lg border border-emerald-500/20 transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          title={language === "bn" ? "অনুমোদন করুন" : "Approve and Add Budget"}
                        >
                          {actionLoadingId === req.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{language === "bn" ? "মঞ্জুর" : "Approve"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
