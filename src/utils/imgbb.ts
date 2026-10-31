// Helpers for the imgbb (i.ibb.co) outage. imgbb now answers some requests
// with a blue "service unavailable" placeholder image (HTTP 200, so onError
// never fires) and hangs on others.

// Cloud name is not hard-coded anywhere else on the client. Set
// VITE_CLOUDINARY_CLOUD_NAME in .env if this fallback is not your cloud.
const CLOUD_NAME: string =
  (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME || "dpihzqpdi";

export const isImgbbUrl = (url?: string | null): boolean =>
  typeof url === "string" && url.includes("ibb.co");

// Pixel sizes [width, height] of the imgbb placeholder image.
// Fill this in once you know it (Admin panel > Manage Listings > "ছবির সাইজ
// পরীক্ষা" shows it). 0x0 (undecodable) is always treated as a placeholder.
export const IMGBB_PLACEHOLDER_SIZES: Array<[number, number]> = [[180, 180]];

const LS_KEY = "gb_imgbb_placeholder_sizes";

const getExtraPlaceholderSizes = (): Array<[number, number]> => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (p: any) => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number"
    ) as Array<[number, number]>;
  } catch {
    return [];
  }
};

// Device-local only (admin's phone). Used by the migration + size probe.
export const addPlaceholderSize = (w: number, h: number): void => {
  try {
    const cur = getExtraPlaceholderSizes();
    if (!cur.some(([a, b]) => a === w && b === h)) cur.push([w, h]);
    localStorage.setItem(LS_KEY, JSON.stringify(cur));
  } catch {
    /* storage unavailable */
  }
};

export const isImgbbPlaceholderSize = (w: number, h: number): boolean => {
  if (!w || !h) return true;
  return [...IMGBB_PLACEHOLDER_SIZES, ...getExtraPlaceholderSizes()].some(
    ([pw, ph]) => pw === w && ph === h
  );
};

// Cloudinary "fetch" delivery: Cloudinary downloads the remote image itself
// and serves a resized copy. c_limit only ever shrinks, so a small
// placeholder keeps its natural size (needed for the size check).
export const getCloudinaryFetchUrl = (url: string, width = 1000): string =>
  `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/f_auto,q_auto,c_limit,w_${width}/${encodeURIComponent(url)}`;
