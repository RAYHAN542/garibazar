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
  console.log(`[Cloudinary] Starting upload to ${url} with preset ${uploadPreset}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    console.log(`[Cloudinary] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[Cloudinary] Upload failed with data:`, errorData);
      throw new Error(errorData?.error?.message || "Cloudinary API error");
    }

    const data = await response.json();
    console.log(`[Cloudinary] Upload successful, received URL: ${data.secure_url}`);
    return data.secure_url;
  } catch (error) {
    console.error(`[Cloudinary] Fetch request threw an error:`, error);
    throw error;
  }
};

