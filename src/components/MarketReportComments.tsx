import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "../supabase";
import { SupportedLanguage } from "../types";

// 💬 বাজার রিপোর্টের মডেলভিত্তিক মন্তব্য (টেবিল: market_report_comments)।
// সবাই পড়তে পারে; লিখতে লগইন লাগে। লিংক/ফোন নম্বর, একই লেখা বারবার, অতিরিক্ত মন্তব্য --
// সবই ডেটাবেসের ট্রিগার আটকায়। নিজের মন্তব্য নিজে মুছতে পারে, অ্যাডমিন যেকোনোটা।

interface Comment {
  id: string;
  uid: string;
  author_name: string;
  body: string;
  created_at: string;
}

const timeAgo = (iso: string, bn: boolean): string => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return bn ? "এইমাত্র" : "just now";
  if (mins < 60) return bn ? `${mins} মিনিট আগে` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return bn ? `${hrs} ঘণ্টা আগে` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return bn ? `${days} দিন আগে` : `${days}d ago`;
};

export default function MarketReportComments({
  modelKey,
  language,
  uid,
  isAdmin,
  onLoginPrompt,
}: {
  modelKey: string;
  language: SupportedLanguage;
  uid: string | null;
  isAdmin: boolean;
  onLoginPrompt: () => void;
}) {
  const bn = language === "bn";
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("market_report_comments")
          .select("id, uid, author_name, body, created_at")
          .eq("model_key", modelKey)
          .order("created_at", { ascending: false })
          .limit(30);
        if (error) throw error;
        if (alive) setList((data as Comment[]) || []);
      } catch (_) {
        if (alive) setList([]);
      }
    })();
    return () => { alive = false; };
  }, [modelKey]);

  const explain = (m: string): string => {
    if (m.includes("comment_link_or_phone")) return bn ? "লিংক বা ফোন নম্বর দেওয়া যাবে না" : "Links and phone numbers aren't allowed";
    if (m.includes("comment_rate_limit")) return bn ? "অনেক মন্তব্য করেছেন, একটু পরে আবার লিখুন" : "Too many comments. Try again a bit later";
    if (m.includes("comment_duplicate")) return bn ? "এই লেখা আপনি আগেই লিখেছেন" : "You already wrote this";
    if (m.includes("comment_length")) return bn ? "২ থেকে ৩০০ অক্ষরের মধ্যে লিখুন" : "Write between 2 and 300 characters";
    return bn ? "মন্তব্য পাঠানো যায়নি, পরে আবার চেষ্টা করুন" : "Couldn't post. Please try again later";
  };

  const submit = async () => {
    if (!uid) {
      onLoginPrompt();
      return;
    }
    const body = text.trim();
    if (body.length < 2) {
      setMsg(bn ? "কিছু লিখুন" : "Write something");
      return;
    }
    setPosting(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from("market_report_comments")
        .insert({ model_key: modelKey, body })
        .select("id, uid, author_name, body, created_at")
        .single();
      if (error) throw error;
      setList((prev) => [data as Comment, ...(prev || [])]);
      setText("");
    } catch (e: any) {
      setMsg(explain(String(e?.message || e || "")));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from("market_report_comments").delete().eq("id", id);
      if (error) throw error;
      setList((prev) => (prev || []).filter((c) => c.id !== id));
    } catch (_) {
      setMsg(bn ? "মোছা যায়নি" : "Couldn't delete");
    }
  };

  return (
    <div className="px-4 pb-4">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
        {bn ? "💬 মন্তব্য" : "💬 Comments"}
        {list ? ` (${list.length})` : ""}
      </p>

      {!list && (
        <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {bn ? "লোড হচ্ছে..." : "Loading..."}
        </div>
      )}

      {list && list.length === 0 && (
        <p className="mt-2 text-xs font-semibold text-slate-400">
          {bn ? "এখনো কোনো মন্তব্য নেই। প্রথম মন্তব্যটা আপনি করুন।" : "No comments yet. Be the first."}
        </p>
      )}

      {list && list.length > 0 && (
        <div className="mt-2 space-y-2">
          {list.map((c) => (
            <div key={c.id} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{c.author_name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400">{timeAgo(c.created_at, bn)}</span>
                  {(c.uid === uid || isAdmin) && (
                    <button type="button" onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-500 cursor-pointer" aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-800 dark:text-slate-100 break-words">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {uid ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={300}
              style={{ overscrollBehaviorY: "contain" }}
              placeholder={bn ? "এই গাড়ির বাজার নিয়ে আপনার অভিজ্ঞতা লিখুন (লিংক বা ফোন নম্বর নয়)" : "Share your experience of this car's market (no links or phone numbers)"}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={posting}
              className="w-full py-2.5 rounded-lg bg-amber-500 disabled:opacity-60 text-slate-950 text-sm font-black cursor-pointer flex items-center justify-center gap-2"
            >
              {posting && <Loader2 className="w-4 h-4 animate-spin" />}
              {bn ? "মন্তব্য করুন" : "Post comment"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onLoginPrompt}
            className="w-full py-2.5 rounded-lg border border-amber-500 text-amber-600 dark:text-amber-400 text-sm font-black cursor-pointer"
          >
            {bn ? "লগইন করে মন্তব্য করুন" : "Log in to comment"}
          </button>
        )}
        {msg && <p className="text-xs font-bold text-red-500">{msg}</p>}
      </div>
    </div>
  );
}
