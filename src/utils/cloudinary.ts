import { logger } from "./logger";
import { auth } from "../firebase";
import { supabase } from "../supabase";
import { apiUrl } from "./apiBase";

const MAX_UPLOAD_DIMENSION = 1600;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

// Resizes + compresses an image in the browser before it ever leaves the
// device, using the native Canvas API (no extra npm dependency). Cloudinary
// was already serving compressed versions on read (getOptimizedImageUrl
// below), but the ORIGINAL full-size file was still being uploaded and
// stored every time -- this wastes upload bandwidth on a slow mobile
// connection and eats into Cloudinary's storage quota for no benefit, since
// nothing in the app ever displays the untouched original.
const resizeAndCompressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_UPLOAD_DIMENSION || height > MAX_UPLOAD_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_UPLOAD_DIMENSION) / width);
          width = MAX_UPLOAD_DIMENSION;
        } else {
          width = Math.round((width * MAX_UPLOAD_DIMENSION) / height);
          height = MAX_UPLOAD_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas compression failed"));
        },
        "image/webp",
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image for compression"));
    };
    img.src = objectUrl;
  });
};

export const uploadToCloudinary = async (file: File | Blob): Promise<string> => {
  // Was: browser uploaded straight to Cloudinary with a public unsigned
  // preset. The preset name + cloud name are visible in the bundled JS, so
  // anyone who found them could upload directly to this Cloudinary account
  // from completely outside the site, burning storage/bandwidth quota with
  // junk files. Now: ask our own /api/cloudinary-sign endpoint for a
  // short-lived signature first -- that endpoint verifies the caller is a
  // real logged-in user of this app (via Firebase ID token) before signing
  // anything, so an outsider with just the preset name can no longer upload.

  // Validate before doing any work: only real images, and not absurdly large
  // (a corrupted/huge file would otherwise hang the compression step below).
  if (file instanceof File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("শুধুমাত্র ছবি (image) ফাইল আপলোড করা যাবে। / Only image files can be uploaded.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("ছবির সাইজ 5MB-এর বেশি হতে পারবে না। / Image size must be under 5MB.");
    }
  }

  // Phone login is now Supabase Auth. Keep Firebase as a compatibility
  // fallback for the still-Firebase social login path.
  let idToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    idToken = data.session?.access_token;
  } catch {
    // Firebase fallback below
  }
  if (!idToken) {
    idToken = await auth.currentUser?.getIdToken();
  }
  if (!idToken) {
    throw new Error("ছবি আপলোড করতে হলে লগইন থাকতে হবে। / You must be logged in to upload images.");
  }

  let uploadBody: Blob = file;
  if (file instanceof File) {
    try {
      uploadBody = await resizeAndCompressImage(file);
    } catch (err) {
      // If compression fails for any reason (unsupported format, corrupt
      // file, etc.) fall back to uploading the original rather than
      // blocking the listing entirely.
      logger.debug("[Cloudinary] Client-side compression failed, uploading original:", err);
      uploadBody = file;
    }
  }

  // Ask our server for a signature. This also doubles as the auth check --
  // if the ID token is missing/expired, this call fails before anything is
  // ever sent to Cloudinary.
  //
  // Wrapped separately from the Cloudinary upload fetch below: a
  // network-level failure here (CORS block, DNS, offline) throws the exact
  // same generic "Failed to fetch" TypeError as a network-level failure in
  // the Cloudinary upload fetch would -- without this distinct [SIGN] /
  // [UPLOAD] prefix, the two are indistinguishable from the error message
  // alone (which is all we can see without remote DevTools on the device).
  let signRes: Response;
  try {
    signRes = await fetch(apiUrl("/api/cloudinary-sign"), {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (err: any) {
    throw new Error(`[SIGN] ${err?.message || err}`);
  }
  if (!signRes.ok) {
    const errData = await signRes.json().catch(() => ({}));
    throw new Error(`[SIGN ${signRes.status}] ${errData?.error || "Failed to authorize upload."}`);
  }
  const { signature, timestamp, apiKey, cloudName, folder, allowedFormats } = await signRes.json();

  const formData = new FormData();
  formData.append("file", uploadBody, uploadBody.type === "image/webp" ? "image.webp" : "image.jpg");
  // Every one of these params must match exactly what cloudinary-sign.ts
  // signed (same keys, same values) or Cloudinary rejects the signature.
  formData.append("upload_preset", "gari_bazar_preset");
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("allowed_formats", allowedFormats);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  logger.debug(`[Cloudinary] Starting signed upload to ${url}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    logger.debug(`[Cloudinary] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Cloudinary] Upload failed with data:`, errorData);
      throw new Error(errorData?.error?.message || "Cloudinary API error");
    }

    const data = await response.json();
    logger.debug(`[Cloudinary] Upload successful, received URL: ${data.secure_url}`);
    return data.secure_url;
  } catch (error: any) {
    console.error(`[Cloudinary] Fetch request threw an error:`, error);
    throw new Error(`[UPLOAD] ${error?.message || error}`);
  }
};

// Returns a resized + auto-compressed version of a Cloudinary URL so images load faster.
// Falls back to the original URL untouched if it isn't a Cloudinary URL.
export const getOptimizedImageUrl = (url: string | undefined | null, width = 1000): string => {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/upload/q_auto") || url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
};
