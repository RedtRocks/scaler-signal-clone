import { isValidPhoneNumber } from "libphonenumber-js/min";

/** Seconds before "Resend code" can be used again. */
export const RESEND_SECONDS = 30;

/** "+15550000001" -> "+1 555 000 0001" (best effort, for display only). */
export function formatPhoneForDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (e164.startsWith("+1") && digits.length === 11) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return e164;
}

/** Fictional numbers of the seeded demo people (the backend allows exactly these, see backend/app/phones.py). */
const DEMO_PHONES = new Set(Array.from({ length: 8 }, (_, i) => `+1555000000${i + 1}`));

/** True when `e164` ("+14155552671") is a real number, or one of the demo accounts. */
export function isValidPhone(e164: string): boolean {
  return DEMO_PHONES.has(e164) || isValidPhoneNumber(e164);
}

export const INVALID_PHONE_MESSAGE = "That doesn't look like a real phone number. Check the country and digits.";
