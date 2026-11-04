// ------------------------------------------------------------------------
// Grabs one still frame from a seller's video to use as the listing's cover
// photo (the market cards and search need a picture for every listing).
// Pure browser APIs -- no extra package.
//
// 🔧 (2026-11-04) কিছু Android WebView-এ ভিডিও seek করার পরও ফ্রেম তখনো আঁকা হয় না,
// তখন canvas-এ ফাঁকা (স্বচ্ছ) ছবি আসে -- ফলে ভিডিও লিস্টিংয়ের কভার সাদা/ফাঁকা
// দেখাত। এখন (১) ভিডিও muted অবস্থায় চালিয়ে রাখা হয়, (২) seek-এর পর ফ্রেম
// আঁকা হওয়া পর্যন্ত অপেক্ষা করা হয়, (৩) ছবি ফাঁকা/একরঙা কি না নমুনা পিক্সেল দিয়ে
// যাচাই করা হয়, আর ফাঁকা হলে ভিডিওর অন্য সময় থেকে আবার চেষ্টা করা হয়।
// ------------------------------------------------------------------------

const POSTER_FAIL_MSG =
  "ভিডিও থেকে কভার ছবি তোলা যায়নি। অন্য ভিডিও দিন। / Could not read this video. Please choose another one.";

// ১০x১০ নমুনা পিক্সেল দেখে ছবি ফাঁকা (স্বচ্ছ) বা প্রায় একরঙা কি না বলে।
const isBlankFrame = (ctx: CanvasRenderingContext2D, w: number, h: number): boolean => {
  try {
    let opaque = 0;
    let minL = 255;
    let maxL = 0;
    for (let gy = 1; gy <= 10; gy++) {
      for (let gx = 1; gx <= 10; gx++) {
        const x = Math.min(w - 1, Math.floor((w * gx) / 11));
        const y = Math.min(h - 1, Math.floor((h * gy) / 11));
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[3] > 8) opaque++;
        const l = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
    }
    return opaque < 30 || maxL - minL < 4;
  } catch (_) {
    // নমুনা পড়া না গেলে ছবিটা বাদ দেওয়া হয় না
    return false;
  }
};

export const captureVideoPoster = (file: File): Promise<File> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    // Kept in the DOM (invisible) because some WebViews won't decode a
    // detached <video>.
    el.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";

    let settled = false;
    const cleanup = () => {
      try { el.pause(); el.remove(); } catch (_) {}
      URL.revokeObjectURL(url);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error(POSTER_FAIL_MSG));
    };
    const timer = setTimeout(fail, 25000);

    const waitSeek = (t: number) =>
      new Promise<void>((res) => {
        const done = () => {
          el.removeEventListener("seeked", done);
          res();
        };
        el.addEventListener("seeked", done);
        el.currentTime = t;
        setTimeout(done, 2500);
      });

    // seek শেষ হলেও ফ্রেম screen/canvas-এ আঁকা হতে একটু সময় লাগে।
    const waitFramePaint = () =>
      new Promise<void>((res) => {
        const anyEl = el as any;
        if (typeof anyEl.requestVideoFrameCallback === "function") {
          let fired = false;
          anyEl.requestVideoFrameCallback(() => {
            fired = true;
            res();
          });
          setTimeout(() => {
            if (!fired) res();
          }, 700);
        } else {
          setTimeout(res, 350);
        }
      });

    const grab = async () => {
      try {
        const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
        const times = [Math.min(1, dur / 4), dur / 2, Math.min(0.3, dur / 10), Math.max(dur - 0.5, 0)];
        // কিছু WebView শুধু চলন্ত ভিডিওর ফ্রেম আঁকে -- muted হওয়ায় অনুমতি লাগে না।
        try { await el.play(); } catch (_) {}

        for (const t of times) {
          if (settled) return;
          await waitSeek(t);
          await waitFramePaint();
          if (settled) return;
          if (!el.videoWidth || !el.videoHeight) continue;

          const maxW = 720;
          const scale = el.videoWidth > maxW ? maxW / el.videoWidth : 1;
          const w = Math.max(1, Math.round(el.videoWidth * scale));
          const h = Math.max(1, Math.round(el.videoHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.drawImage(el, 0, 0, w, h);
          if (isBlankFrame(ctx, w, h)) continue;

          // JPEG: স্বচ্ছতা (alpha) নেই, তাই ফাঁকা অংশ আর "সাদা ছবি" হয়ে আসবে না।
          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
          if (!blob) continue;
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          resolve(new File([blob], "poster.jpg", { type: blob.type || "image/jpeg" }));
          return;
        }
        fail();
      } catch (_) {
        fail();
      }
    };

    el.onerror = fail;
    el.onloadedmetadata = () => {
      void grab();
    };

    document.body.appendChild(el);
    el.src = url;
  });
