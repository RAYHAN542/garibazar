import { SupportedLanguage } from "../types";

/**
 * Formats a raw number to localized digits (Bangla or English) with proper comma separators.
 */
export function formatNumber(num: number, lang: SupportedLanguage): string {
  if (lang === "en") {
    return num.toLocaleString("en-US");
  }
  
  const formattedEn = num.toLocaleString("en-US");
  const bnDigits: Record<string, string> = {
    "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪",
    "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯"
  };
  
  return formattedEn.replace(/[0-9]/g, (digit) => bnDigits[digit] || digit);
}

/**
 * Formats a number to currency layout based on the active language (৳ 50,000 / BDT 50,000)
 */
export function formatPrice(price: number, lang: SupportedLanguage): string {
  const formattedNum = formatNumber(price, lang);
  return lang === "bn" ? `৳${formattedNum}` : `${formattedNum} BDT`;
}
