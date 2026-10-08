const DIGITS_MIN = 7;
const DIGITS_MAX = 15;

/**
 * Turns what someone typed into an E.164 number, or null if it cannot be one.
 * A leading "+" is taken as given; otherwise `defaultDial` ("+1") is prepended.
 */
export function normalizePhone(input: string, defaultDial = "+1"): string | null {
  const trimmed = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const full = trimmed.startsWith("+") ? digits : defaultDial.replace(/\D/g, "") + digits.replace(/^0+/, "");
  if (full.length < DIGITS_MIN || full.length > DIGITS_MAX) return null;
  return `+${full}`;
}

/** True when the text reads as a phone number rather than a name search. */
export function looksLikePhone(input: string): boolean {
  const trimmed = input.trim();
  return /^\+?[\d\s().-]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 4;
}
