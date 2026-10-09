import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, isValidPhone } from "./otp";

describe("otp helpers", () => {
  it("formats NANP numbers and leaves others alone", () => {
    expect(formatPhoneForDisplay("+15550000001")).toBe("+1 555 000 0001");
    expect(formatPhoneForDisplay("+919876543210")).toBe("+919876543210");
  });
  it("accepts real numbers and the demo accounts", () => {
    expect(isValidPhone("+14155552671")).toBe(true);
    expect(isValidPhone("+919876543210")).toBe(true);
    expect(isValidPhone("+15550000001")).toBe(true);
    expect(isValidPhone("+15550000008")).toBe(true);
  });
  it("rejects fake or malformed numbers", () => {
    expect(isValidPhone("+15551234567")).toBe(false);
    expect(isValidPhone("+11234567890")).toBe(false);
    expect(isValidPhone("+1123")).toBe(false);
    expect(isValidPhone("+15550000009")).toBe(false);
  });
});
