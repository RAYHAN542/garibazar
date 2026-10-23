// ------------------------------------------------------------------------
// Grabs one still frame from a seller's video to use as the listing's cover
// photo (the market cards and search need a picture for every listing).
// Pure browser APIs -- no extra package.
// ------------------------------------------------------------------------

const POSTER_FAIL_MSG =
  "ভিডিও থেকে কভার ছবি তোলা যায়নি। অন্য ভিডিও দিন। / Could not read this video. Please choose another one.";

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
    const timer = setTimeout(fail, 15000);

    el.onerror = fail;
    el.onloadedmetadata = () => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
      el.currentTime = Math.min(1, dur / 4);
    };
    el.onseeked = () => {
      if (settled) return;
      try {
        if (!el.videoWidth || !el.videoHeight) throw new Error("no frame");
        const maxW = 720;
        const scale = el.videoWidth > maxW ? maxW / el.videoWidth : 1;
        const w = Math.max(1, Math.round(el.videoWidth * scale));
        const h = Math.max(1, Math.round(el.videoHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        ctx.drawImage(el, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (settled) return;
            if (!blob) {
              fail();
              return;
            }
            settled = true;
            clearTimeout(timer);
            cleanup();
            const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
            resolve(new File([blob], `poster.${ext}`, { type: blob.type }));
          },
          "image/webp",
          0.8
        );
      } catch (_) {
        fail();
      }
    };

    document.body.appendChild(el);
    el.src = url;
  });
