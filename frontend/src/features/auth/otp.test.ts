import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, isPlausibleNational } from "./otp";

describe("otp helpers", () => {
  it("formats NANP numbers and leaves others alone", () => {
    expect(formatPhoneForDisplay("+15550000001")).toBe("+1 555 000 0001");
    expect(formatPhoneForDisplay("+919876543210")).toBe("+919876543210");
  });
  it("checks national number length", () => {
    expect(isPlausibleNational("(555) 000-0001")).toBe(true);
    expect(isPlausibleNational("123")).toBe(false);
  });
});
