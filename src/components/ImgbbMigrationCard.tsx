import React, { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, ImageOff } from "lucide-react";
import { supabase } from "../supabase";
import { uploadToCloudinary } from "../utils/cloudinary";
import {
  isImgbbUrl,
  getCloudinaryFetchUrl,
  isImgbbPlaceholderSize,
  addPlaceholderSize,
} from "../utils/imgbb";
import { SupportedLanguage } from "../types";

interface Props {
  language: SupportedLanguage;
}

type Row = { id: string; images: string[] };

const PAGE = 1000;

async function scanImgbbListings(): Promise<{ rows: Row[]; scanned: number }> {
  const rows: Row[] = [];
  let from = 0;
  let scanned = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("listings")
      .select("id,images")
      .eq("is_deleted", false)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch: any[] = data || [];
    scanned += batch.length;
    for (const r of batch) {
      const imgs: string[] = Array.isArray(r.images) ? r.images : [];
      if (imgs.some((u) => isImgbbUrl(u))) rows.push({ id: r.id, images: imgs });
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { rows, scanned };
}

async function fetchBlob(url: string, timeoutMs = 25000): Promise<Blob> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("not an image");
    return blob;
  } finally {
    window.clearTimeout(t);
  }
}

function blobSize(blob: Blob): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(u);
      resolve([img.naturalWidth, img.naturalHeight]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("decode failed"));
    };
    img.src = u;
  });
}

function probeUrlSize(url: string): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const t = window.setTimeout(() => {
      img.src = "";
      resolve(null);
    }, 12000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve([img.naturalWidth, img.naturalHeight]);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(null);
    };
    img.src = url;
  });
}

// Download the original (direct first, then via Cloudinary fetch in case it
// has a cached copy), refuse the imgbb placeholder, re-upload through the
// app's normal upload path (uploadToCloudinary: resize/compress, then R2 with
// Cloudinary fallback) and return the new URL.
async function migrateOne(url: string): Promise<string> {
  const sources: Array<[string, string]> = [
    ["direct", url],
    ["cloudinary", getCloudinaryFetchUrl(url, 2000)],
  ];
  const errs: string[] = [];
  for (const [label, src] of sources) {
    try {
      const blob = await fetchBlob(src);
      const [w, h] = await blobSize(blob);
      if (isImgbbPlaceholderSize(w, h)) throw new Error(`placeholder/blank ${w}x${h}`);
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      const file = new File([blob], `migrated.${ext}`, { type: blob.type });
      return await uploadToCloudinary(file);
    } catch (e: any) {
      errs.push(`${label}: ${e?.message || e}`);
    }
  }
  throw new Error(errs.join(" | "));
}

export function ImgbbMigrationCard({ language }: Props) {
  const bn = language === "bn";
  const [counting, setCounting] = useState(true);
  const [counts, setCounts] = useState<{ listings: number; images: number; scanned: number } | null>(null);
  const [countErr, setCountErr] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, migrated: 0, failed: 0, images: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [probing, setProbing] = useState(false);
  const [buckets, setBuckets] = useState<Array<[string, number]>>([]);
  const [savedBucket, setSavedBucket] = useState("");
  const cancelRef = useRef(false);
  const rowsRef = useRef<Row[]>([]);

  const refreshCount = async () => {
    setCounting(true);
    setCountErr("");
    try {
      const { rows, scanned } = await scanImgbbListings();
      rowsRef.current = rows;
      const images = rows.reduce((n, r) => n + r.images.filter((u) => isImgbbUrl(u)).length, 0);
      setCounts({ listings: rows.length, images, scanned });
      console.info(`[imgbb] ${rows.length} of ${scanned} listings still use ibb.co URLs (${images} images)`);
    } catch (e: any) {
      console.error("[imgbb] scan failed:", e);
      setCountErr(e?.message || String(e));
    } finally {
      setCounting(false);
    }
  };

  useEffect(() => {
    refreshCount();
  }, []);

  const probeSizes = async () => {
    setProbing(true);
    setSavedBucket("");
    const urls = rowsRef.current.flatMap((r) => r.images.filter((u) => isImgbbUrl(u))).slice(0, 30);
    const tally: Record<string, number> = {};
    const queue = [...urls];
    const worker = async () => {
      while (queue.length) {
        const u = queue.shift()!;
        const s = await probeUrlSize(u);
        const k = s ? `${s[0]}x${s[1]}` : "fail";
        tally[k] = (tally[k] || 0) + 1;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setBuckets(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 6));
    setProbing(false);
  };

  const markBucket = (key: string) => {
    const m = key.match(/^(\d+)x(\d+)$/);
    if (!m) return;
    addPlaceholderSize(Number(m[1]), Number(m[2]));
    setSavedBucket(key);
  };

  const run = async () => {
    if (running) return;
    const ok = window.confirm(
      bn
        ? "সব পুরনো imgbb ছবি Cloudinary/R2-তে সরানো হবে। চালাবেন?"
        : "Move all old imgbb images to new storage now?"
    );
    if (!ok) return;

    cancelRef.current = false;
    setRunning(true);
    setFinished(false);
    setErrors([]);

    try {
      // Fail early with a clear message if the SQL step was skipped.
      const probe = await supabase.from("listings").select("legacy_image_urls").limit(1);
      if (probe.error) {
        setErrors([
          (bn ? "আগে SQL চালান (legacy_image_urls কলাম নেই): " : "Run the SQL first (legacy_image_urls column missing): ") +
            probe.error.message,
        ]);
        setRunning(false);
        return;
      }

      const { rows } = await scanImgbbListings();
      rowsRef.current = rows;
      const p = { done: 0, total: rows.length, migrated: 0, failed: 0, images: 0 };
      setProgress({ ...p });
      const errs: string[] = [];

      for (const row of rows) {
        if (cancelRef.current) break;
        const newImages = [...row.images];
        const replaced: string[] = [];
        let failedAny = false;

        for (let j = 0; j < newImages.length; j++) {
          if (cancelRef.current) break;
          const original = row.images[j];
          if (!isImgbbUrl(original)) continue;
          try {
            newImages[j] = await migrateOne(original);
            replaced.push(original);
            p.images++;
          } catch (e: any) {
            failedAny = true;
            errs.push(`${row.id}: ${e?.message || e}`);
          }
        }

        if (replaced.length > 0) {
          const cur = await supabase.from("listings").select("legacy_image_urls").eq("id", row.id).maybeSingle();
          const prev: string[] = Array.isArray((cur.data as any)?.legacy_image_urls)
            ? (cur.data as any).legacy_image_urls
            : [];
          const legacy = Array.from(new Set([...prev, ...replaced]));
          const upd = await supabase
            .from("listings")
            .update({ images: newImages, legacy_image_urls: legacy })
            .eq("id", row.id)
            .select("id");
          if (upd.error || !upd.data || upd.data.length === 0) {
            failedAny = true;
            errs.push(`${row.id}: update ${upd.error ? upd.error.message : "blocked (0 rows, check RLS)"}`);
          }
        }

        p.done++;
        if (failedAny) p.failed++;
        else p.migrated++;
        setProgress({ ...p });
        setErrors(errs.slice(-5));
      }

      if (errs.length) console.error("[imgbb] migration errors:", errs);
      setFinished(true);
    } catch (e: any) {
      console.error("[imgbb] migration crashed:", e);
      setErrors([e?.message || String(e)]);
    } finally {
      setRunning(false);
      refreshCount();
    }
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
          <ImageOff className="w-4 h-4 text-red-500" />
          {bn ? "পুরনো imgbb ছবি" : "Old imgbb images"}
        </h5>
        <button
          type="button"
          onClick={refreshCount}
          disabled={counting || running}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${counting ? "animate-spin" : ""}`} />
        </button>
      </div>

      {countErr ? (
        <p className="text-xs font-bold text-red-500">{countErr}</p>
      ) : counting && !counts ? (
        <p className="text-xs text-slate-400 font-semibold">{bn ? "গুনছি..." : "Counting..."}</p>
      ) : counts ? (
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {bn
            ? `${counts.scanned}টির মধ্যে ${counts.listings}টি লিস্টিং এখনো imgbb ব্যবহার করছে (${counts.images}টি ছবি)`
            : `${counts.listings} of ${counts.scanned} listings still use imgbb (${counts.images} images)`}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running || counting || !counts || counts.listings === 0}
          className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5"
        >
          {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {bn ? "পুরনো ছবি সরাও" : "Migrate old images"}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              cancelRef.current = true;
            }}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs"
          >
            {bn ? "থামাও" : "Stop"}
          </button>
        )}
        <button
          type="button"
          onClick={probeSizes}
          disabled={probing || running || !counts || counts.images === 0}
          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          {probing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {bn ? "ছবির সাইজ পরীক্ষা" : "Check image sizes"}
        </button>
      </div>

      {buckets.length > 0 && (
        <div className="text-[11px] space-y-1">
          <p className="text-slate-500 font-semibold">
            {bn
              ? "যে সাইজ অনেকবার আসছে (নীল 'unavailable' ছবি) সেটায় ট্যাপ করুন:"
              : "Tap the size that repeats a lot (the blue 'unavailable' image):"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {buckets.map(([k, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => markBucket(k)}
                className={`px-2 py-1 rounded-md font-mono font-bold border ${
                  savedBucket === k
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {k} ×{n}
              </button>
            ))}
          </div>
        </div>
      )}

      {(running || finished || progress.total > 0) && (
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {progress.done}/{progress.total} ({pct}%) · {bn ? "সফল" : "migrated"}: {progress.migrated} · {bn ? "ব্যর্থ" : "failed"}: {progress.failed} · {bn ? "ছবি" : "images"}: {progress.images}
            {finished && ` · ${bn ? "শেষ" : "done"}`}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="text-[10px] font-mono text-red-500 space-y-0.5 break-all">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
