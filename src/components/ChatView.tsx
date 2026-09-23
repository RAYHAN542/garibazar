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
  listingId: string | null;
  listingTitle: string;
  listingImage: string;
  listingPrice: number;
  lastMessage: string;
  lastMessageAt?: { seconds: number };
  participants: string[];
  unreadCount?: Record<string, number>;
}

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: { seconds: number };
}

// 🔧 (2026-09-24) FULL MIGRATION: this component used to read/write Firestore
// directly (chats, chats/{id}/messages, users.blockedUids). That relied on
// request.auth.uid in firestore.rules, which is only ever set for users who
// signed in through Firebase Auth -- but login has fully moved to Supabase
// Auth, so every user who logged in since then had no Firebase session at
// all, and every chat read/write here failed with permission-denied. Chat
// was completely broken for them (thread list, messages, sending, blocking).
// Rewritten against the `chats` / `chat_messages` Postgres tables (already
// created in Supabase with matching RLS -- see current_uid()-based policies)
// using Supabase Realtime instead of Firestore's onSnapshot. The 2-second
// per-message cooldown that used to live in firestore.rules is now enforced
// server-side by a Postgres trigger on chat_messages (enforce_chat_message_
// cooldown), so it can't be bypassed by calling this table directly either.
const isUuidLike = (v: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);

const toEpochSeconds = (iso: string | null | undefined): number =>
  iso ? Math.floor(new Date(iso).getTime() / 1000) : Math.floor(Date.now() / 1000);

function mapThreadRow(row: any): ChatThread {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    buyerName: row.buyer_name,
    sellerName: row.seller_name,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingImage: row.listing_image,
    listingPrice: Number(row.listing_price || 0),
    lastMessage: row.last_message || "",
    lastMessageAt: { seconds: toEpochSeconds(row.last_message_at) },
    participants: [row.participant_a, row.participant_b],
    unreadCount: row.unread_count || {},
  };
}

function mapMessageRow(row: any): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    text: row.text,
    createdAt: { seconds: toEpochSeconds(row.created_at) },
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
  // instead of guessed CSS (calc(100dvh-...px) turned out unreliable on
  // some Android WebViews, and guessing the exact pixel offset by eye from
  // screenshots kept over/under-shooting). getBoundingClientRect().top
  // already accounts for everything rendered above the card, whatever it
  // is, so nothing needs to be guessed except the fixed bottom-nav height.
  const chatCardRef = useRef<HTMLDivElement>(null);
  const [mobileCardHeight, setMobileCardHeight] = useState<number | null>(null);
  useEffect(() => {
    const BOTTOM_NAV_RESERVE = 78; // fixed bottom tab bar + safe-area, roughly
    const MIN_HEIGHT = 380;

    const recompute = () => {
      if (!chatCardRef.current) return;
      if (window.innerWidth >= 1024) {
        // Desktop keeps the original fixed 600px card (see lg:h-[600px] class below)
        setMobileCardHeight(null);
        return;
      }
      const top = chatCardRef.current.getBoundingClientRect().top;
      const available = window.innerHeight - top - BOTTOM_NAV_RESERVE;
      setMobileCardHeight(Math.max(available, MIN_HEIGHT));
    };

    recompute();
    // Re-measure a beat later too -- on first paint, mobile browser chrome
    // (address bar collapsing etc.) can still be settling.
    const settleTimer = setTimeout(recompute, 250);
    const settleTimer2 = setTimeout(recompute, 800);

    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    window.visualViewport?.addEventListener("resize", recompute);

    // 🔧 ResizeObserver: catches layout shifts that window "resize" misses
    // entirely -- e.g. content above the chat card growing/shrinking,
    // virtual keyboard opening, images finishing load, etc. This is what
    // makes the height genuinely reliable instead of a one-time guess.
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

  useEffect(() => {
    setMsgLimit(20);
    setHasMoreMessages(false);
    prevLimitRef.current = 20;
  }, [activeThread?.id]);

  const [blocking, setBlocking] = useState(false);
  const [localBlockedUids, setLocalBlockedUids] = useState<string[]>([]);

  // Sync local blocked list to fallback instantly
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
      // Add partnerId to blocked_uids in current user's row (fetch-then-set;
      // a single user blocking one person at a time makes the race window
      // here negligible, same trade-off the old arrayUnion call implicitly
      // made).
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

      // Also let's save to local storage for instant offline sync fallback
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

      // Deselect active thread
      setActiveThread(null);
      
      // Dispatch storage event to trigger listings refresh
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

  // Quick Preset Messages for Bangladeshi Buy-Sell context
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

  // 1. Fetch chat threads for current user, then keep them live via Realtime.
  // The `current_uid() = participant_a OR participant_b` RLS check can't be
  // expressed as a single Realtime filter, so two channels are used (one per
  // column) and any event on either just triggers a full refetch -- simplest
  // way to guarantee the list always matches what the old onSnapshot() gave,
  // without hand-rolling insert/update/delete merge logic here.
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoadingThreads(false);
      return;
    }

    let active = true;

    const fetchThreads = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .or(`participant_a.eq.${currentUser.uid},participant_b.eq.${currentUser.uid}`)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (error) {
        console.error("Error fetching chats:", error);
        setLoadingThreads(false);
        return;
      }
      const list = (data || []).map(mapThreadRow);
      setThreads(list);
      setLoadingThreads(false);

      if (initialListingToChat) {
        initiateOrOpenChatThread(list);
      }
    };

    setLoadingThreads(true);
    fetchThreads();

    const channel = supabase
      .channel(`chats-list-${currentUser.uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats", filter: `participant_a=eq.${currentUser.uid}` }, fetchThreads)
      .on("postgres_changes", { event: "*", schema: "public", table: "chats", filter: `participant_b=eq.${currentUser.uid}` }, fetchThreads)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, initialListingToChat]);

  // 2. Fetch messages of the active thread, then keep them live via Realtime
  // -- any change on this chat_id refetches the current window, same
  // "always reflects current server truth" behavior the old onSnapshot gave.
  useEffect(() => {
    if (!activeThread?.id) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    let active = true;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      setMessagesError(null);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", activeThread.id)
        .order("created_at", { ascending: false })
        .limit(msgLimit + 1); // fetch one extra to know if truly more remain
      if (!active) return;
      if (error) {
        console.error("Error fetching messages:", error);
        setLoadingMessages(false);
        setMessagesError(`[${(error as any)?.code || "unknown"}] ${error.message || String(error)}`);
        return;
      }

      let rows = data || [];
      const hasMore = rows.length > msgLimit;
      if (hasMore) rows = rows.slice(0, msgLimit);
      setHasMoreMessages(hasMore);

      const list = rows.map(mapMessageRow).reverse(); // chronological order

      // Remove pending (optimistic) messages that are now confirmed by the server
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
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `chat_id=eq.${activeThread.id}` }, fetchMessages)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, msgLimit]);

  // Auto scroll to bottom only when a genuinely new message arrives at the
  // end -- NOT when older history gets prepended via "Load Older Messages"
  // (that used to fire on every Firestore sync, even cache/metadata-only
  // events, which kept yanking the chat back down while someone was trying
  // to scroll up and read older messages).
  useEffect(() => {
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      return;
    }
    // 🔧 Scroll the message *container* itself (not the whole page) --
    // scrollIntoView() on the end marker used to bubble up and jump the
    // entire Android WebView page instead of just this inner list, because
    // the container wasn't a reliably-bounded scroll box (see the grid/
    // height fix above). Setting scrollTop directly keeps the jump local.
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
        const { error } = await supabase
          .from("chats")
          .update({ unread_count: { ...(thread.unreadCount || {}), [currentUser.uid]: 0 } })
          .eq("id", thread.id);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to clear unread count:", err);
      }
    }
  };

  // Helper to trigger thread creation on first interaction
  const initiateOrOpenChatThread = async (currentThreads: ChatThread[]) => {
    if (!initialListingToChat || !currentUser) return;

    // Check if we are chatting with ourselves
    if (initialListingToChat.sellerId === currentUser.uid) {
      alert(language === "bn" ? "আপনি নিজের বিজ্ঞাপনে চ্যাট করতে পারবেন না!" : "You cannot chat on your own listings!");
      if (onClearInitialListing) onClearInitialListing();
      return;
    }

    // See if thread already exists for this buying user & seller/listing combination
    const existing = currentThreads.find(
      (t) => t.listingId === initialListingToChat.id && t.buyerId === currentUser.uid
    );

    if (existing) {
      setActiveThread(existing);
      if (onClearInitialListing) onClearInitialListing();
      return;
    }

    const sellerId = initialListingToChat.sellerId || "unknown_seller";
    // `chats.listing_id` is a uuid column -- listings created before the
    // Supabase migration may still carry a legacy Firestore string id here,
    // which can't be stored in that column. The chat still works fine
    // without it (listing_title/image/price are snapshotted separately for
    // display); it just won't be matched by listing_id in the "existing
    // thread" lookup above for those older listings.
    const listingIdForRow = isUuidLike(initialListingToChat.id) ? initialListingToChat.id : null;

    const newThreadData = {
      participant_a: currentUser.uid,
      participant_b: sellerId,
      buyer_id: currentUser.uid,
      seller_id: sellerId,
      buyer_name: currentUser.displayName || "Buyer",
      seller_name: initialListingToChat.sellerName || "Anonymous Seller",
      listing_id: listingIdForRow,
      listing_title: initialListingToChat.title || "Untitled Listing",
      listing_image: initialListingToChat.image || (initialListingToChat as any).images?.[0] || "",
      listing_price: initialListingToChat.price || 0,
      last_message: language === "bn" ? "চ্যাট শুরু হয়েছে" : "Chat conversation started",
      last_message_at: new Date().toISOString(),
    };

    try {
      const { data: inserted, error } = await supabase
        .from("chats")
        .insert(newThreadData)
        .select()
        .single();
      if (error) throw error;
      setActiveThread(mapThreadRow(inserted));
    } catch (e) {
      console.error("Error creating chat thread:", e);
    }

    if (onClearInitialListing) onClearInitialListing();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const finalMsg = (textToSend || newMessage).trim();
    if (!finalMsg || !activeThread || !currentUser) return;
    if (sendLockRef.current) return; // ignore rapid duplicate taps
    sendLockRef.current = true;
    setTimeout(() => { sendLockRef.current = false; }, 700);

    if (!textToSend) {
      setNewMessage("");
    }

    // Show the message instantly, before waiting for the server
    const tempMsg: ChatMessage = {
      id: "temp_" + Date.now(),
      senderId: currentUser.uid,
      text: finalMsg,
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    };
    pendingMessagesRef.current = [...pendingMessagesRef.current, tempMsg];
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const partnerId = activeThread.buyerId === currentUser.uid ? activeThread.sellerId : activeThread.buyerId;

      // The server-side cooldown trigger (enforce_chat_message_cooldown) is
      // what actually enforces the 2-second-per-message limit -- this insert
      // is rejected outright (P0001) if it fires too soon, same protection
      // firestore.rules used to give.
      const { error: insertErr } = await supabase.from("chat_messages").insert({
        chat_id: activeThread.id,
        sender_id: currentUser.uid,
        text: finalMsg,
      });
      if (insertErr) throw insertErr;

      // Update the thread's preview/unread badge. Not atomic with the
      // message insert above (Postgres via supabase-js has no simple
      // multi-table client transaction) -- worst case on a dropped
      // connection between the two calls is a stale preview/badge, not a
      // lost or duplicated message, same trade-off as before.
      const { error: updateErr } = await supabase
        .from("chats")
        .update({
          last_message: finalMsg,
          last_message_at: new Date().toISOString(),
          unread_count: {
            ...(activeThread.unreadCount || {}),
            [partnerId]: ((activeThread.unreadCount || {})[partnerId] || 0) + 1,
          },
        })
        .eq("id", activeThread.id);
      if (updateErr) console.error("Failed to update chat preview:", updateErr);

    } catch (e: any) {
      console.error("Error sending message:", e);
      // Roll back the optimistic bubble we added above -- it never actually
      // saved, so leaving it on screen would look like a sent message that
      // silently vanishes for the other person.
      pendingMessagesRef.current = pendingMessagesRef.current.filter((m) => m.id !== tempMsg.id);
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      if (e?.code === "P0001" || /cooldown/i.test(e?.message || "")) {
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
                  {/* Item Image Mini */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-slate-700 relative">
                    <ImageWithFallback src={thread.listingImage} alt={thread.listingTitle} className="w-full h-full object-cover" />
                    {thread.unreadCount?.[currentUser.uid] > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-slate-950"></span>
                    )}
                  </div>

                  {/* Thread details brief */}
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
            {/* Conversations Header details */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Back button on mobile */}
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
                {/* Secure Chat indicator status */}
                <div className="hidden sm:flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{language === "bn" ? "নিরাপদ চ্যাট" : "Secure Chat"}</span>
                </div>

                {/* Block User/Seller Button */}
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

            {/* MESSAGE CONTAINER */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 bg-slate-950/20" style={{ overscrollBehavior: "contain" }}>
              
              {/* Educational info tips */}
              <div className="text-center py-2 px-4 rounded-xl bg-slate-800/30 border border-slate-800/50 max-w-sm mx-auto text-[10px] text-slate-500 leading-normal">
                🔐 {language === "bn" 
                  ? "সরাসরি ইন-অ্যাপ চ্যাট করুন নিরাপদে। অগ্রিম কোনো বড় পেমেন্ট বা লেনদেন করবেন না।" 
                  : "Keep correspondence inside. Never issue advanced payments before physical item inspection."}
              </div>

              {/* Load Older Messages Button */}
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

            {/* PRESETS PANEL FOR SPEED negotiations */}
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

            {/* MESSAGE INPUT SECTION */}
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
                ? "বামে তালিকা থেকে চ্যাট নির্বাচন করুন অথবা লিস্টিং ডিটেইলস এর ‘ইন-অ্যাপ চ্যাট’ এ ক্লিক করুন।"
                : "Select an existing thread from the left list or initiate a direct chat session with any listing organizer."}
            </p>
          </div>
        )}

      </div>

    </div>
  );
}
