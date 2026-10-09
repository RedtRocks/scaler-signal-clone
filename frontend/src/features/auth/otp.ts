import { isPossiblePhoneNumber } from "libphonenumber-js/min";

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

/** True when `e164` ("+14155552671") has a possible length for its country (10 digits for +1, etc.). */
export function isValidPhone(e164: string): boolean {
  return isPossiblePhoneNumber(e164);
}

export const INVALID_PHONE_MESSAGE = "Enter a phone number with the right number of digits for its country.";
