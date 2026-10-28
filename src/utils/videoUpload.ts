import { nativeFetch } from "./nativeFetch";
import { supabase } from "../supabase";
import { apiUrl } from "./apiBase";

// ------------------------------------------------------------------------
// Seller listing videos.
//
// 1) prepareVideo(): keeps only the first 20 seconds and shrinks the file ON
//    THE PHONE (re-records it at a low bitrate with MediaRecorder -- no extra
//    npm package, no new Play Store build). A video that is already short and
//    small is uploaded untouched. Users are only ever told "max 20 seconds",
//    never a file size.
// 2) uploadVideoToR2(): asks /api/cloudinary-sign (kind: "video") for a
//    short-lived presigned URL, then PUTs the file straight to Cloudflare R2.
// ------------------------------------------------------------------------

export const MAX_VIDEO_SECONDS = 20;

const SKIP_REENCODE_MAX_BYTES = 24 * 1024 * 1024; // short (<=20s) => upload the original untouched (server cap is 25 MB)
const FALLBACK_MAX_BYTES = 20 * 1024 * 1024; // if re-encoding is unsupported
const UPLOADABLE_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type ProgressFn = (percent: number) => void;

const UNREADABLE_MSG =
  "এই ভিডিও পড়া যাচ্ছে না। অন্য একটা ভিডিও দিন। / This video could not be read. Please choose another one.";
const CANNOT_SHRINK_MSG =
  "এই ফোনে ভিডিও ছোট করা যায়নি। ২০ সেকেন্ডের কম সময়ের ভিডিও দিন। / Could not process this video. Please use a video under 20 seconds.";

const loadVideoElement = (src: string): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "auto";
    el.playsInline = true;
    el.onloadedmetadata = () => resolve(el);
    el.onerror = () => reject(new Error(UNREADABLE_MSG));
    el.src = src;
  });

const pickRecorderMime = (): string => {
  const MR: any = (window as any).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== "function") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((m) => MR.isTypeSupported(m)) || "";
};

// Plays the video (silently, off-screen) and records its first `limitSeconds`
// seconds at a low bitrate. Audio is routed through WebAudio so it is recorded
// but never played out loud.
const recordFirstSeconds = async (
  el: HTMLVideoElement,
  limitSeconds: number,
  onProgress: ProgressFn
): Promise<Blob> => {
  const MR: any = (window as any).MediaRecorder;
  const capture = (el as any).captureStream || (el as any).mozCaptureStream;
  if (!MR || !capture) throw new Error("UNSUPPORTED");
  const mime = pickRecorderMime();

  let audioCtx: AudioContext | null = null;
  let audioTracks: MediaStreamTrack[] = [];
  let captured: MediaStream | null = null;
  let recorder: any = null;

  try {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) {
        const ctx: AudioContext = new AC();
        // resume() can hang forever when the WebView blocks audio autoplay, so
        // give it a short deadline and fall back to a silent video instead.
        await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
        if (ctx.state === "running") {
          const source = ctx.createMediaElementSource(el);
          const dest = ctx.createMediaStreamDestination();
          source.connect(dest);
          audioTracks = dest.stream.getAudioTracks();
          audioCtx = ctx;
        } else {
          ctx.close().catch(() => {});
        }
      }
    } catch (_) {
      audioTracks = [];
    }

    el.currentTime = 0;
    try {
      await el.play();
    } catch (_) {
      el.muted = true;
      await el.play();
    }

    captured = capture.call(el) as MediaStream;
    const videoTracks = captured.getVideoTracks();
    if (videoTracks.length === 0) throw new Error("UNSUPPORTED");
    if (audioTracks.length === 0) {
    try { audioTracks = captured.getAudioTracks(); } catch (_) {}
  }
  const stream = new MediaStream([...videoTracks, ...audioTracks]);

    const chunks: Blob[] = [];
    recorder = new MR(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: 64_000,
    });
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = () => reject(new Error(CANNOT_SHRINK_MSG));
      recorder.onstop = () =>
        resolve(new Blob(chunks, { type: (recorder.mimeType || mime || "video/webm").split(";")[0] }));
    });
    recorder.start(1000);

    await new Promise<void>((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        const t = el.currentTime;
        onProgress(Math.min(99, Math.round((t / limitSeconds) * 100)));
        const timedOut = Date.now() - startedAt > (limitSeconds + 20) * 1000;
        if (t >= limitSeconds - 0.05 || el.ended || timedOut) {
          resolve();
          return;
        }
        setTimeout(tick, 200);
      };
      tick();
    });

    el.pause();
    if (recorder.state !== "inactive") recorder.stop();
    const blob = await done;
    if (blob.size < 1024) throw new Error("UNSUPPORTED");
    onProgress(100);
    return blob;
  } finally {
    try { if (recorder && recorder.state !== "inactive") recorder.stop(); } catch (_) {}
    try { captured?.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { audioCtx?.close(); } catch (_) {}
  }
};

export const prepareVideo = async (file: File, onProgress: ProgressFn): Promise<Blob> => {
  const objectUrl = URL.createObjectURL(file);
  let el: HTMLVideoElement | null = null;
  try {
    el = await loadVideoElement(objectUrl);
    // Kept in the DOM (invisible) because some WebViews won't decode a
    // detached <video>.
    el.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(el);

    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : MAX_VIDEO_SECONDS;
    const type = (file.type || "").toLowerCase();
    const uploadable = UPLOADABLE_TYPES.includes(type);

    // Already short and small: upload untouched (no quality loss, no waiting).
    if (uploadable && duration <= MAX_VIDEO_SECONDS + 0.5 && file.size <= SKIP_REENCODE_MAX_BYTES) {
      onProgress(100);
      return file;
    }

    try {
      return await recordFirstSeconds(el, Math.min(duration, MAX_VIDEO_SECONDS), onProgress);
    } catch (err) {
      console.error("[video] re-encode failed:", err);
      if (uploadable && duration <= MAX_VIDEO_SECONDS + 0.5 && file.size <= FALLBACK_MAX_BYTES) {
        onProgress(100);
        return file;
      }
      throw new Error(CANNOT_SHRINK_MSG);
    }
  } finally {
    try { el?.pause(); el?.remove(); } catch (_) {}
    URL.revokeObjectURL(objectUrl);
  }
};

export const uploadVideoToR2 = async (blob: Blob, onProgress?: ProgressFn): Promise<string> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("ভিডিও আপলোড করতে হলে লগইন থাকতে হবে। / You must be logged in to upload a video.");
  }

  const contentType = (blob.type || "video/mp4").split(";")[0].toLowerCase();

  let signRes: Response;
  try {
    signRes = await nativeFetch(apiUrl("/api/cloudinary-sign"), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "video", contentType, size: blob.size }),
    });
  } catch (err: any) {
    throw new Error(`[VIDEO SIGN] ${err?.message || err}`);
  }
  if (!signRes.ok) {
    const errData = await signRes.json().catch(() => ({}));
    throw new Error(`[VIDEO SIGN ${signRes.status}] ${errData?.error || "Failed to authorize video upload."}`);
  }
  const { uploadUrl, publicUrl } = await signRes.json();
  if (!uploadUrl || !publicUrl) throw new Error("[VIDEO SIGN] bad response");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    // Must match exactly what the server signed.
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`[VIDEO UPLOAD ${xhr.status}] ${xhr.responseText?.slice(0, 120) || "upload rejected"}`));
    };
    xhr.onerror = () => reject(new Error("[VIDEO UPLOAD] network error"));
    xhr.ontimeout = () => reject(new Error("[VIDEO UPLOAD] timeout"));
    xhr.timeout = 120000;
    xhr.send(blob);
  });

  return publicUrl as string;
};
