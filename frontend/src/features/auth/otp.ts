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

/** National-number validity check used before asking the server for a code. */
export function isPlausibleNational(national: string): boolean {
  const digits = national.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 14;
}
