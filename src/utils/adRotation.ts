import type { PartListing } from "../types";

// কতগুলো বুস্ট করা অ্যাড কোথায় দেখাবে -- সবগুলো একসাথে না দেখিয়ে সীমা দেওয়া হয়েছে,
// যাতে অনেক অ্যাড থাকলেও সবাই পালা করে সুযোগ পায় (প্রতিবার পেজ লোডে র‍্যান্ডম অর্ডার)।
export const MAX_SPOTLIGHT_ADS = 8; // উপরের "Premium Sponsored Spotlights" স্লাইডার
export const MAX_INLINE_ADS = 6; // মেইন ফিডের ভেতরে ছড়ানো অ্যাড
export const ADS_INTERLEAVE_GAP = 6; // প্রতি ৬টা সাধারণ পোস্টের পর ১টা অ্যাড

export function shuffleArray<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// সাধারণ পোস্টের ফিডের ভেতরে প্রতি `gap`-টা পোস্টের পর একটা করে অ্যাড বসায়।
// অ্যাড বেশি থাকলে বাকিগুলো ফিডের শেষে যায়।
export function interleaveAds(
  organic: PartListing[],
  ads: PartListing[],
  gap: number
): PartListing[] {
  if (ads.length === 0) return organic;
  const result: PartListing[] = [];
  let adIndex = 0;
  organic.forEach((item, i) => {
    result.push(item);
    if ((i + 1) % gap === 0 && adIndex < ads.length) {
      result.push(ads[adIndex++]);
    }
  });
  while (adIndex < ads.length) {
    result.push(ads[adIndex++]);
  }
  return result;
}
