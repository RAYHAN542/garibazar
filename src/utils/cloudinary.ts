import { logger } from "./logger";

export const uploadToCloudinary = async (file: File | Blob): Promise<string> => {
  const cloudName = "dpihzqpdi";
  const uploadPreset = "gari_bazar_preset";

  if (!cloudName || !uploadPreset) {
    throw new Error(`Cloudinary config missing: CLOUD_NAME=${cloudName ? 'OK' : 'MISSING'}, UPLOAD_PRESET=${uploadPreset ? 'OK' : 'MISSING'}`);
  }

  const formData = new FormData();
  if (file instanceof File) {
    formData.append("file", file);
  } else {
    // Standard way to append a blob with a filename
    formData.append("file", file, "image.jpg");
  }
  formData.append("upload_preset", uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  logger.debug(`[Cloudinary] Starting upload to ${url} with preset ${uploadPreset}`);

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
  } catch (error) {
    console.error(`[Cloudinary] Fetch request threw an error:`, error);
    throw error;
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
