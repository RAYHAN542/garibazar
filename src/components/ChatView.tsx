import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { SupportedLanguage, PartListing } from "../types";
import { Send, User, MessageSquare, ArrowLeft, Loader2, HeartHandshake, ShieldCheck } from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";

interface ChatViewProps {
  currentUser: any;
  language: SupportedLanguage;
  onLoginPrompt: () => void;
  initialListingToChat?: PartListing | null;
  onClearInitialListing?: () => void;
}

interface ChatThread {
  id: string;
  buyerId: string;
  sellerId: string;
  buyerName: string;
  sellerName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  lastMessage: string;
  lastMessageAt?: any;
  participants: string[];
  unreadCount?: Record<string, number>;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

// --- Supabase row <-> UI shape mappers (chats/chat_messages use snake_case) ---
function mapChatRow(row: any): ChatThread {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    buyerName: row.buyer_name,
    sellerName: row.seller_name,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingImage: row.listing_image,
    listingPrice: row.listing_price,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at ? { seconds: Math.floor(new Date(row.last_message_at).getTime() / 1000) } : null,
    participants: [row.participant_a, row.participant_b],
    unreadCount: row.unread_count || {},
  };
}

function mapMessageRow(row: any): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at ? { seconds: Math.floor(new Date(row.created_at).getTime() / 1000) } : null,
  };
}

export function ChatView({ currentUser, language, onLoginPrompt, initialListingToChat, onClearInitialListing }: ChatViewProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendCooldownNotice, setSendCooldownNotice] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const pendingMessagesRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // 🔧 Prevents rapid double-taps (esp. on quick-reply preset buttons) from
  // firing handleSendMessage multiple times before the first send finishes,
  // which was causing the same message to appear 2-3 times in a row.
  const sendLockRef = useRef(false);

  const [msgLimit, setMsgLimit] = useState(20);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const prevLimitRef = useRef(20);
  // Set to true right before "Load Older Messages" bumps msgLimit, so the
  // auto-scroll-to-bottom effect knows to skip once (see effect below).
  const loadingOlderRef = useRef(false);

  // 📱 Mobile chat card height -- measured with real JS layout numbers
  const chatCardRef = useRef<HTMLDivElement>(null);
  const [mobileCardHeight, setMobileCardHeight] = useState<number | null>(null);
  useEffect(() => {
    const BOTTOM_NAV_RESERVE = 78;
    const MIN_HEIGHT = 380;

    const recompute = () => {
      if (!chatCardRef.current) return;
      if (window.innerWidth >= 1024) {
        setMobileCardHeight(null);
        return;
      }
      const top = chatCardRef.current.getBoundingClientRect().top;
      const available = window.innerHeight - top - BOTTOM_NAV_RESERVE;
      setMobileCardHeight(Math.max(available, MIN_HEIGHT));
    };

    recompute();
    const settleTimer = setTimeout(recompute, 250);
    const settleTimer2 = setTimeout(recompute, 800);

    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    window.visualViewport?.addEventListener("resize", recompute);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => recompute());
      ro.observe(document.body);
      if (chatCardRef.current) ro.observe(chatCardRef.current);
    }

    return () => {
      clearTimeout(settleTimer);
      clearTimeout(settleTimer2);
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
      window.visualViewport?.removeEventListener("resize", recompute);
      ro?.disconnect();
    };
  }, []);

  // 🔧 Migrated Firebase Auth -> Supabase Auth: authReady now reflects
  // whether a Supabase session exists (RLS on chats/chat_messages checks
  // the Supabase JWT via current_uid()), not Firebase's onAuthStateChanged.
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setAuthReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthReady(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMsgLimit(20);
    setHasMoreMessages(false);
    prevLimitRef.current = 20;
  }, [activeThread?.id]);

  const [blocking, setBlocking] = useState(false);
  const [localBlockedUids, setLocalBlockedUids] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gari_bazar_blocked_uids") || "[]";
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setLocalBlockedUids(parsed);
      }
    } catch (e) {}

    const handleStorage = () => {
      try {
        const stored = localStorage.getItem("gari_bazar_blocked_uids") || "[]";
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setLocalBlockedUids(parsed);
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 🔧 Migrated: block list now lives in Supabase `users.blocked_uids`
  // (text[] column, already present from the Firestore -> Supabase data
  // migration) instead of a Firestore arrayUnion update.
  const handleBlockSeller = async () => {
    if (!currentUser || !activeThread) return;
    const partnerId = activeThread.buyerId === currentUser.uid ? activeThread.sellerId : activeThread.buyerId;
    const partnerName = activeThread.buyerId === currentUser.uid ? activeThread.sellerName : activeThread.buyerName;

    const confirmBlock = window.confirm(
      language === "bn"
        ? `আপনি কি নিশ্চিতভাবে ${partnerName}-কে ব্লক করতে চান? ব্লক করলে তার কোনো বিজ্ঞাপন বা মেসেজ আপনি আর দেখতে পাবেন না।`
        : `Are you sure you want to block ${partnerName}? You will no longer see their listings or messages.`
    );
    if (!confirmBlock) return;

    setBlocking(true);
    try {
      const { data: userRow, error: fetchErr } = await supabase
        .from("users")
        .select("blocked_uids")
        .eq("uid", currentUser.uid)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const current: string[] = userRow?.blocked_uids || [];
      if (!current.includes(partnerId)) {
        const { error: updateErr } = await supabase
          .from("users")
          .update({ blocked_uids: [...current, partnerId] })
          .eq("uid", currentUser.uid);
        if (updateErr) throw updateErr;
      }

      try {
        const stored = localStorage.getItem("gari_bazar_blocked_uids") || "[]";
        const parsed = JSON.parse(stored);
        const nextBlocked = Array.isArray(parsed) ? [...parsed] : [];
        if (!nextBlocked.includes(partnerId)) {
          nextBlocked.push(partnerId);
          localStorage.setItem("gari_bazar_blocked_uids", JSON.stringify(nextBlocked));
        }
      } catch (e) {}

      alert(
        language === "bn"
          ? "ইউজার সফলভাবে ব্লক হয়েছে!"
          : "User blocked successfully!"
      );

      setActiveThread(null);
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Error blocking user:", err);
      alert(
        language === "bn"
          ? "ব্লক করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
          : "Failed to block user. Please try again."
      );
    } finally {
      setBlocking(false);
    }
  };

  const blockedUids = [
    ...(currentUser?.blockedUids || []),
    ...localBlockedUids
  ];

  const visibleThreads = threads.filter((t) => {
    const partnerId = t.buyerId === currentUser.uid ? t.sellerId : t.buyerId;
    return !blockedUids.includes(partnerId);
  });

  const BANGLA_PRESETS = [
    "এটি কি এখনো বিক্রির জন্য আছে?",
    "ভাইয়া, দাম কিছুটা কম রাখা যাবে?",
    "আমি এটি সরাসরি দেখতে চাই, কোথায় আসতে হবে?",
    "আপনার সাথে যোগাযোগের সঠিক সময় কোনটি?"
  ];

  const ENGLISH_PRESETS = [
    "Is this item still available?",
    "Can we negotiate the price a bit?",
    "I would like to inspect the item, where should we meet?",
    "What is the best time to call you?"
  ];

  const presets = language === "bn" ? BANGLA_PRESETS : ENGLISH_PRESETS;

  // 1. Fetch chat threads for current user, then live-refresh via Supabase
  // Realtime. Supabase's postgres_changes filter can't express an OR across
  // two columns (participant_a / participant_b) directly, so we subscribe
  // unfiltered and just re-fetch on any change -- fine at this table's
  // current size, and avoids maintaining two parallel channels.
  useEffect(() => {
    if (!currentUser?.uid || !authReady) {
      setLoadingThreads(false);
      return;
    }

    let cancelled = false;

    const fetchThreads = async () => {
      setLoadingThreads(true);
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .or(`participant_a.eq.${currentUser.uid},participant_b.eq.${currentUser.uid}`)
        .order("last_message_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) {
        console.error("Error fetching chats:", error);
        setLoadingThreads(false);
        return;
      }

      const list: ChatThread[] = (data || []).map(mapChatRow);
      setThreads(list);
      setLoadingThreads(false);

      if (initialListingToChat) {
        initiateOrOpenChatThread(list);
      }
    };

    fetchThreads();

    const channel = supabase
      .channel(`chats-list-${currentUser.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        fetchThreads();
      })
      .subscribe();

    // Same fallback reasoning as the messages poll above -- keeps thread
    // previews/unread badges fresh even if realtime doesn't fire.
    const pollInterval = setInterval(fetchThreads, 5000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.uid, initialListingToChat, authReady]);

  // 2. Fetch messages of active thread + live-refresh on new inserts
  useEffect(() => {
    if (!activeThread?.id || !authReady) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    setMessagesError(null);

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", activeThread.id)
        .order("created_at", { ascending: false })
        .limit(msgLimit + 1); // fetch one extra to know if truly more remain

      if (cancelled) return;
      if (error) {
        console.error("Error fetching messages:", error);
        setLoadingMessages(false);
        setMessagesError(error.message || "unknown error");
        return;
      }

      let list: ChatMessage[] = (data || []).map(mapMessageRow);

      const hasMore = list.length > msgLimit;
      if (hasMore) list.pop();
      setHasMoreMessages(hasMore);

      list.reverse(); // chronological order

      pendingMessagesRef.current = pendingMessagesRef.current.filter(
        (temp) => !list.some((real) => real.senderId === temp.senderId && real.text === temp.text)
      );

      setMessages([...list, ...pendingMessagesRef.current]);
      setLoadingMessages(false);
      prevLimitRef.current = msgLimit;
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-messages-${activeThread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${activeThread.id}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    // 🔧 Fallback poll every 3s alongside the realtime subscription above.
    // Realtime's RLS check (via current_uid(), which reads custom JWT GUCs)
    // doesn't always evaluate the same way inside Supabase's Realtime
    // broadcast path as it does for normal REST calls -- when that happens
    // postgres_changes silently never fires and new messages only showed up
    // after a manual reload. Polling guarantees messages appear within a
    // few seconds either way, realtime working or not.
    const pollInterval = setInterval(fetchMessages, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeThread?.id, msgLimit, authReady]);

  useEffect(() => {
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      return;
    }
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleSelectThread = async (thread: ChatThread) => {
    setActiveThread(thread);
    if (thread.unreadCount?.[currentUser?.uid] && thread.unreadCount[currentUser.uid] > 0) {
      try {
        const newUnread = { ...(thread.unreadCount || {}), [currentUser.uid]: 0 };
        const { error } = await supabase.from("chats").update({ unread_count: newUnread }).eq("id", thread.id);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to clear unread count:", err);
      }
    }
  };

  // Helper to trigger thread creation on first interaction. `chats.id` is a
  // Postgres uuid (gen_random_uuid() default), so unlike the old Firestore
  // deterministic doc id, we insert first and let Postgres assign the id.
  const initiateOrOpenChatThread = async (currentThreads: ChatThread[]) => {
    if (!initialListingToChat || !currentUser) return;

    if (initialListingToChat.sellerId === currentUser.uid) {
      alert(language === "bn" ? "আপনি নিজের বিজ্ঞাপনে চ্যাট করতে পারবেন না!" : "You cannot chat on your own listings!");
      if (onClearInitialListing) onClearInitialListing();
      return;
    }

    const existing = currentThreads.find(
      (t) => t.listingId === initialListingToChat.id && t.buyerId === currentUser.uid
    );

    if (existing) {
      setActiveThread(existing);
      if (onClearInitialListing) onClearInitialListing();
      return;
    }

    const sellerId = initialListingToChat.sellerId || "unknown_seller";
    const nowIso = new Date().toISOString();

    try {
      const { data: inserted, error } = await supabase
        .from("chats")
        .insert({
          participant_a: currentUser.uid,
          participant_b: sellerId,
          buyer_id: currentUser.uid,
          seller_id: sellerId,
          buyer_name: currentUser.displayName || "Buyer",
          seller_name: initialListingToChat.sellerName || "Anonymous Seller",
          listing_id: initialListingToChat.id,
          listing_title: initialListingToChat.title || "Untitled Listing",
          listing_image: initialListingToChat.image || (initialListingToChat as any).images?.[0] || "",
          listing_price: initialListingToChat.price || 0,
          last_message: language === "bn" ? "চ্যাট শুরু হয়েছে" : "Chat conversation started",
          last_message_at: nowIso,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveThread(mapChatRow(inserted));
    } catch (e) {
      console.error("Error creating chat thread:", e);
    }

    if (onClearInitialListing) onClearInitialListing();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const finalMsg = (textToSend || newMessage).trim();
    if (!finalMsg || !activeThread || !currentUser) return;
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    setTimeout(() => { sendLockRef.current = false; }, 700);

    if (!textToSend) {
      setNewMessage("");
    }

    const tempMsg: ChatMessage = {
      id: "temp_" + Date.now(),
      senderId: currentUser.uid,
      text: finalMsg,
      createdAt: { seconds: Math.floor(Date.now() / 1000) } as any
    };
    pendingMessagesRef.current = [...pendingMessagesRef.current, tempMsg];
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const partnerId = activeThread.buyerId === currentUser.uid ? activeThread.sellerId : activeThread.buyerId;

      // Two sequential writes (insert message, then update thread meta) --
      // Postgres RLS enforces both are scoped to the caller, but unlike the
      // old Firestore writeBatch these aren't atomic. Acceptable here: a
      // dropped connection between the two just means a stale thread
      // preview/unread badge, never a lost message.
      const { error: insertError } = await supabase.from("chat_messages").insert({
        chat_id: activeThread.id,
        sender_id: currentUser.uid,
        text: finalMsg,
      });
      if (insertError) throw insertError;

      const newUnread = {
        ...(activeThread.unreadCount || {}),
        [partnerId]: (activeThread.unreadCount?.[partnerId] || 0) + 1,
      };
      const { error: updateError } = await supabase
        .from("chats")
        .update({
          last_message: finalMsg,
          last_message_at: new Date().toISOString(),
          unread_count: newUnread,
        })
        .eq("id", activeThread.id);
      if (updateError) console.error("Failed to update chat thread meta:", updateError);
    } catch (e: any) {
      console.error("Error sending message:", e);
      pendingMessagesRef.current = pendingMessagesRef.current.filter((m) => m.id !== tempMsg.id);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      // Postgres RLS violation code, equivalent to Firestore's "permission-denied"
      if (e?.code === "42501" || /row-level security|permission/i.test(e?.message || "")) {
        setSendCooldownNotice(true);
        setTimeout(() => setSendCooldownNotice(false), 2500);
      }
    }
  };

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-6 text-center">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 mb-4 animate-pulse">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">
          {language === "bn" ? "চ্যাট করতে লগইন করুন" : "Login Required to Chat"}
        </h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          {language === "bn" 
            ? "বায়ার এবং বিক্রেতাদের সাথে ইন-অ্যাপ চ্যাট এবং দরদাম করতে আপনার অ্যাকাউন্টে লগইন করুন।" 
            : "Connect directly with buyers and sellers in real-time, negotiate prices, and organize inspections."}
        </p>
        <button
          onClick={onLoginPrompt}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/10 cursor-pointer"
        >
          {language === "bn" ? "লগইন / সাইন আপ" : "Login / SignUp"}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={chatCardRef}
      className="grid grid-cols-1 lg:grid-cols-12 grid-rows-[minmax(0,1fr)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden lg:h-[600px] shadow-2xl min-h-[380px] h-[70dvh]"
      style={mobileCardHeight !== null ? { height: mobileCardHeight } : undefined}
    >

      {/* LEFT COLUMN: THREAD LIST (Hidden on mobile when conversation is active) */}
      <div className={`col-span-1 lg:col-span-4 border-r border-slate-800 flex flex-col h-full min-h-0 bg-slate-950/40 ${activeThread ? "hidden lg:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h2 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>{language === "bn" ? "আমার চ্যাটসমূহ" : "My Conversations"}</span>
          </h2>
          <span className="bg-slate-800 text-[10px] text-slate-400 font-bold px-2 py-0.5 rounded-full">
            {visibleThreads.length} {language === "bn" ? "টি বার্তা" : "active"}
          </span>
        </div>

        {loadingThreads ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
            <span className="text-xs">{language === "bn" ? "চ্যাট লোড হচ্ছে..." : "Loading chats..."}</span>
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400/60 text-center space-y-2">
            <HeartHandshake className="w-10 h-10 text-slate-500/50" />
            <p className="text-xs font-semibold">{language === "bn" ? "কোন চ্যাট রেকর্ড পাওয়া যায়নি" : "No Chats Found"}</p>
            <p className="text-[10px] text-slate-500 max-w-[180px]">{language === "bn" ? "একটি উইজেটে ক্লিক করুন এবং মেসেজ পাঠান ল্যাভ পেতে!" : "Click on any item details to launch real-time seller chat negotiations."}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
            {visibleThreads.map((thread) => {
              const isBuyer = thread.buyerId === currentUser.uid;
              const chatPartner = isBuyer ? thread.sellerName : thread.buyerName;
              const active = activeThread?.id === thread.id;

              return (
                <div
                  key={thread.id}
                  onClick={() => handleSelectThread(thread)}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-center gap-3 border ${
                    active 
                      ? "bg-slate-800/80 border-amber-500/30 shadow-md" 
                      : "bg-transparent border-transparent hover:bg-slate-800/30"
                  }`}
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-slate-700 relative">
                    <ImageWithFallback src={thread.listingImage} alt={thread.listingTitle} className="w-full h-full object-cover" />
                    {thread.unreadCount?.[currentUser.uid] > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-slate-950"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-slate-200 text-xs truncate max-w-[110px]">
                        {chatPartner}
                      </span>
                      <span className="text-[10px] text-amber-500 font-extrabold font-mono">
                        ৳{thread.listingPrice.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium truncate mb-0.5">
                      {thread.listingTitle}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">
                      {thread.lastMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: CHAT WINDOW */}
      <div className={`col-span-1 lg:col-span-8 flex flex-col h-full min-h-0 bg-slate-900/30 relative ${!activeThread ? "hidden lg:flex" : "flex"}`}>
        {activeThread ? (
          <>
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => setActiveThread(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 lg:hidden shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                  <ImageWithFallback src={activeThread.listingImage} alt={activeThread.listingTitle} className="w-full h-full object-cover" />
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-slate-100 text-xs sm:text-sm line-clamp-1">
                    {activeThread.listingTitle}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300 truncate max-w-[110px]">
                      {activeThread.buyerId === currentUser.uid ? activeThread.sellerName : activeThread.buyerName}
                    </span>
                    <span className="shrink-0">•</span>
                    <span className="font-black text-amber-500 font-mono shrink-0">
                      ৳{activeThread.listingPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{language === "bn" ? "নিরাপদ চ্যাট" : "Secure Chat"}</span>
                </div>

                <button
                  type="button"
                  onClick={handleBlockSeller}
                  disabled={blocking}
                  className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition duration-150 flex items-center gap-1 cursor-pointer disabled:opacity-55 shrink-0"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                  <span>
                    {language === "bn" ? "ব্লক করুন" : "Block Seller"}
                  </span>
                </button>
              </div>
            </div>

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 bg-slate-950/20" style={{ overscrollBehavior: "contain" }}>

              <div className="text-center py-2 px-4 rounded-xl bg-slate-800/30 border border-slate-800/50 max-w-sm mx-auto text-[10px] text-slate-500 leading-normal">
                🔐 {language === "bn" 
                  ? "সরাসরি ইন-অ্যাপ চ্যাট করুন নিরাপদে। অগ্রিম কোনো বড় পেমেন্ট বা লেনদেন করবেন না।" 
                  : "Keep correspondence inside. Never issue advanced payments before physical item inspection."}
              </div>

              {hasMoreMessages && (
                <div className="text-center py-1">
                  <button
                    type="button"
                    onClick={() => {
                      loadingOlderRef.current = true;
                      setMsgLimit((prev) => prev + 20);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white rounded-xl text-[10px] sm:text-xs font-black transition cursor-pointer"
                  >
                    {language === "bn" ? "⬆️ পূর্ববর্তী মেসেজ লোড করুন" : "⬆️ Load Older Messages"}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : messagesError ? (
                <div className="text-center text-red-400 text-xs py-8 px-4 break-words">
                  {language === "bn" ? "মেসেজ লোড করা যায়নি: " : "Could not load messages: "}
                  {messagesError}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8 animate-pulse">
                  {language === "bn" ? "চ্যাট কথোপকথন শুরু করুন..." : "Say hello to begin negotiating..."}
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.senderId === currentUser.uid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[75%] rounded-2xl p-3 text-xs flex flex-col ${
                        isOwn 
                          ? "bg-amber-500 text-slate-950 rounded-tr-none font-medium" 
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60"
                      }`}>
                        <span>{msg.text}</span>
                        <span className={`text-[8.5px] mt-1 self-end font-mono leading-none ${
                          isOwn ? "text-slate-950/60" : "text-slate-500"
                        }`}>
                          {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending..."}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {sendCooldownNotice && (
              <div className="px-4 py-1.5 bg-amber-500/10 border-t border-amber-500/20 text-center">
                <span className="text-[10px] font-semibold text-amber-500">
                  {language === "bn" ? "একটু ধীরে — কয়েক সেকেন্ড পর আবার পাঠান" : "Slow down — try sending again in a moment"}
                </span>
              </div>
            )}

            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/30 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none select-none shrink-0">
              {presets.map((msgPreset, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(msgPreset)}
                  className="bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 rounded-xl px-3 py-1.5 text-[10px] sm:text-xs font-medium cursor-pointer transition shrink-0"
                >
                  {msgPreset}
                </button>
              ))}
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-900 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={language === "bn" ? "বার্তা লিখুন..." : "Type your message..."}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 text-xs sm:text-sm rounded-xl px-4 py-2.5 outline-none transition"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-2.5 rounded-xl shrink-0 transition flex items-center justify-center cursor-pointer ${
                    newMessage.trim() 
                      ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/10" 
                      : "bg-slate-800 text-slate-600 pointer-events-none"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-800/40 border border-slate-800/60 rounded-2xl flex items-center justify-center text-slate-500 mb-1">
              <MessageSquare className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs font-bold text-slate-400">
              {language === "bn" ? "কোন চ্যাট নির্বাচন করা হয়নি" : "No Active Conversation"}
            </p>
            <p className="text-[10px] text-slate-500 max-w-xs">
              {language === "bn"
                ? "বামে তালিকা থেকে চ্যাট নির্বাচন করুন অথবা লিস্টিং ডিটেইলস এর 'ইন-অ্যাপ চ্যাট' এ ক্লিক করুন।"
                : "Select an existing thread from the left list or initiate a direct chat session with any listing organizer."}
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
