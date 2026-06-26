/**
 * Robust Client-Side Sanitization & Validation Utilities for Gari Bazar App
 * Helps mitigate XSS injections, script injection, and ensures strict data integrity.
 */

/**
 * Strips basic HTML tags and cross-site scripting attempts from input text.
 */
export function sanitizeText(str: string, maxLength: number = 2000): string {
  if (!str) return "";
  
  // 1. Strip HTML tags using regex
  let cleaned = str.replace(/<\/?[^>]+(>|$)/g, "");

  // 2. Escape dangerous character patterns
  cleaned = cleaned
    .replace(/javascript:/gi, "")
    .replace(/onerror/gi, "")
    .replace(/onload/gi, "")
    .replace(/onclick/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 3. Trim length bounds
  return cleaned.substring(0, maxLength).trim();
}

/**
 * Validates a Bangladeshi mobile phone number (e.g. 01712345678, total 11 digits).
 */
export function validateBanglaPhone(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\D/g, "");
  // Must be 11 digits starting with 01
  return /^01[3-9]\d{8}$/.test(cleanPhone);
}

/**
 * Sanitizes and validates a price input, ensuring it's a positive number.
 */
export function validatePriceInput(price: any): number {
  const num = Number(price);
  if (isNaN(num) || num < 0 || num > 99999999) {
    return 0;
  }
  return Math.round(num);
}
