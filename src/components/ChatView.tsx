import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, setDoc, updateDoc, arrayUnion, limit, increment } from "firebase/firestore";
import { db } from "../firebase";
import { SupportedLanguage, PartListing } from "../types";
import { Send, User, MessageSquare, ArrowLeft, Loader2, HeartHandshake, Phone, ShieldCheck } from "lucide-react";
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

export function ChatView({ currentUser, language, onLoginPrompt, initialListingToChat, onClearInitialListing }: ChatViewProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [msgLimit, setMsgLimit] = useState(20);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const prevLimitRef = useRef(20);

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
      // Add partnerId to blockedUids in current user's document
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        blockedUids: arrayUnion(partnerId)
      });

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
          ? "ইউজার সফলভাবে ব্লক হয়েছে!"
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
          ? "ব্লক করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
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
    "ভাইয়া, দাম কিছুটা কম রাখা যাবে?",
    "আমি এটি সরাসরি দেখতে চাই, কোথায় আসতে হবে?",
    "আপনার সাথে যোগাযোগের সঠিক সময় কোনটি?"
  ];

  const ENGLISH_PRESETS = [
    "Is this item still available?",
    "Can we negotiate the price a bit?",
    "I would like to inspect the item, where should we meet?",
    "What is the best time to call you?"
  ];

  const presets = language === "bn" ? BANGLA_PRESETS : ENGLISH_PRESETS;

  // 1. Fetch Chat Threads for current user in real-time
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoadingThreads(false);
      return;
    }

    setLoadingThreads(true);
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ChatThread[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ChatThread);
      });
      
      // Sort threads by date client side safely
      list.sort((a, b) => {
        const aT = a.lastMessageAt?.seconds || 0;
        const bT = b.lastMessageAt?.seconds || 0;
        return bT - aT;
      });

      setThreads(list);
      setLoadingThreads(false);

      // If we are looking to start or open a thread from initial listing to chat
      if (initialListingToChat) {
        initiateOrOpenChatThread(list);
      }
    }, (err) => {
      console.error("Error subscribing to chats:", err);
      setLoadingThreads(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid, initialListingToChat]);

  // 2. Fetch messages of active thread
  useEffect(() => {
    if (!activeThread?.id) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const msgsQuery = query(
      collection(db, "chats", activeThread.id, "messages"),
      orderBy("createdAt", "desc"),
      limit(msgLimit)
    );

    const unsubscribe = onSnapshot(msgsQuery, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      
      setHasMoreMessages(list.length === msgLimit);
      
      list.reverse(); // Display in chronological order
      setMessages(list);
      setLoadingMessages(false);
      
      // Scroll to bottom only if limit didn't increase (e.g. first load or new incoming messages)
      if (msgLimit === prevLimitRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
      prevLimitRef.current = msgLimit;
    }, (err) => {
      console.error("Error subscribing to messages:", err);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [activeThread?.id, msgLimit]);

  // Auto scroll to bottom when messages list size changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSelectThread = async (thread: ChatThread) => {
    setActiveThread(thread);
    if (thread.unreadCount?.[currentUser?.uid] && thread.unreadCount[currentUser.uid] > 0) {
      try {
        await updateDoc(doc(db, "chats", thread.id), {
          [`unreadCount.${currentUser.uid}`]: 0
        });
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

    // Otherwise, build a new chat thread doc in Firestore
    const combinationId = `chat_${currentUser.uid}_${initialListingToChat.sellerId}_${initialListingToChat.id}`;
    const newThread: Omit<ChatThread, "id"> = {
      buyerId: currentUser.uid,
      sellerId: initialListingToChat.sellerId || "unknown_seller",
      buyerName: currentUser.displayName || "Buyer",
      sellerName: initialListingToChat.sellerName || "Anonymous Seller",
      listingId: initialListingToChat.id,
      listingTitle: initialListingToChat.title || "Untitled Listing",
      listingImage: initialListingToChat.image || (initialListingToChat as any).images?.[0] || "",
      listingPrice: initialListingToChat.price || 0,
      lastMessage: language === "bn" ? "চ্যাট শুরু হয়েছে" : "Chat conversation started",
      lastMessageAt: serverTimestamp(),
      participants: [currentUser.uid, initialListingToChat.sellerId || "unknown_seller"]
    };

    try {
      await setDoc(doc(db, "chats", combinationId), newThread);
      const fullThread: ChatThread = { id: combinationId, ...newThread };
      setActiveThread(fullThread);
    } catch (e) {
      console.error("Error creating chat thread:", e);
    }

    if (onClearInitialListing) onClearInitialListing();
  };

  const handleSendMessage = async (textToSend?: string) => {
    const finalMsg = (textToSend || newMessage).trim();
    if (!finalMsg || !activeThread || !currentUser) return;

    if (!textToSend) {
      setNewMessage("");
    }

    try {
      const chatDocRef = doc(db, "chats", activeThread.id);
      
      // Write message to subcollection
      await addDoc(collection(chatDocRef, "messages"), {
        senderId: currentUser.uid,
        text: finalMsg,
        createdAt: serverTimestamp(),
        participants: [activeThread.buyerId, activeThread.sellerId]
      });

      // Update parent summary info
      const partnerId = activeThread.buyerId === currentUser.uid ? activeThread.sellerId : activeThread.buyerId;
      await updateDoc(chatDocRef, {
        lastMessage: finalMsg,
        lastMessageAt: serverTimestamp(),
        [`unreadCount.${partnerId}`]: increment(1)
      });

    } catch (e) {
      console.error("Error sending message:", e);
      alert("DEBUG SEND ERROR: " + String(e));
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
            ? "বায়ার এবং বিক্রেতাদের সাথে ইন-অ্যাপ চ্যাট এবং দরদাম করতে আপনার অ্যাকাউন্টে লগইন করুন।" 
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
    <div className="grid grid-cols-1 lg:grid-cols-12 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-[600px] shadow-2xl">
      
      {/* LEFT COLUMN: THREAD LIST (Hidden on mobile when conversation is active) */}
      <div className={`col-span-1 lg:col-span-4 border-r border-slate-800 flex flex-col h-full bg-slate-950/40 ${activeThread ? "hidden lg:flex" : "flex"}`}>
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
            <p className="text-xs font-semibold">{language === "bn" ? "কোন চ্যাট রেকর্ড পাওয়া যায়নি" : "No Chats Found"}</p>
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
      <div className={`col-span-1 lg:col-span-8 flex flex-col h-full bg-slate-900/30 relative ${!activeThread ? "hidden lg:flex" : "flex"}`}>
        {activeThread ? (
          <>
            {/* Conversations Header details */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setActiveThread(null)}
                  className="p-1 text-slate-400 hover:text-slate-100 lg:hidden"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                  <ImageWithFallback src={activeThread.listingImage} alt={activeThread.listingTitle} className="w-full h-full object-cover" />
                </div>

                <div>
                  <h3 className="font-bold text-slate-100 text-xs sm:text-sm line-clamp-1">
                    {activeThread.listingTitle}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="font-bold text-slate-300">
                      {activeThread.buyerId === currentUser.uid ? activeThread.sellerName : activeThread.buyerName}
                    </span>
                    <span>•</span>
                    <span className="font-black text-amber-500 font-mono">
                      ৳{activeThread.listingPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 bg-slate-950/20">
              
              {/* Educational info tips */}
              <div className="text-center py-2 px-4 rounded-xl bg-slate-800/30 border border-slate-800/50 max-w-sm mx-auto text-[10px] text-slate-500 leading-normal">
                🔐 {language === "bn" 
                  ? "সরাসরি ইন-অ্যাপ চ্যাট করুন নিরাপদে। অগ্রিম কোনো বড় পেমেন্ট বা লেনদেন করবেন না।" 
                  : "Keep correspondence inside. Never issue advanced payments before physical item inspection."}
              </div>

              {/* Load Older Messages Button */}
              {hasMoreMessages && (
                <div className="text-center py-1">
                  <button
                    type="button"
                    onClick={() => {
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

            {/* PRESETS PANEL FOR SPEED negotiations */}
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/30 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none select-none">
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
            <div className="p-3.5 border-t border-slate-800 bg-slate-900">
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
                      : "bg-slate-800 text-slate-505 text-slate-600 pointer-events-none"
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
              {language === "bn" ? "কোন চ্যাট নির্বাচন করা হয়নি" : "No Active Conversation"}
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
