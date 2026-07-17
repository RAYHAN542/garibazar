/**
 * Input Validation Utilities for Gari Bazar App
 * Strict validation: reject suspicious input instead of trying to strip/escape it.
 */

export function sanitizeText(str: string, maxLength: number = 2000): string {
  if (!str) return "";

  const trimmed = str.trim();

  if (trimmed.length > maxLength) {
    throw new Error(`Text exceeds maximum length of ${maxLength} characters.`);
  }

  if (/[<>]/.test(trimmed) || /javascript:/i.test(trimmed)) {
    throw new Error("Text contains invalid characters.");
  }

  return trimmed;
}

export function validateBanglaPhone(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\D/g, "");
  return /^01[3-9]\d{8}$/.test(cleanPhone);
}

export function validatePriceInput(price: any): number {
  const num = Number(price);
  if (isNaN(num) || num < 0 || num > 99999999) {
    return 0;
  }
  return Math.round(num);
}
