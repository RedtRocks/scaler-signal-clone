import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, isValidPhone } from "./otp";

describe("otp helpers", () => {
  it("formats NANP numbers and leaves others alone", () => {
    expect(formatPhoneForDisplay("+15550000001")).toBe("+1 555 000 0001");
    expect(formatPhoneForDisplay("+919876543210")).toBe("+919876543210");
  });
  it("accepts right-length numbers", () => {
    expect(isValidPhone("+14155552671")).toBe(true);
    expect(isValidPhone("+15551234567")).toBe(true);
    expect(isValidPhone("+919876543210")).toBe(true);
    expect(isValidPhone("+15550000001")).toBe(true);
  });
  it("rejects numbers of the wrong length", () => {
    expect(isValidPhone("+1")).toBe(false);
    expect(isValidPhone("+112")).toBe(false);
    expect(isValidPhone("+1123")).toBe(false);
    expect(isValidPhone("+155512345678901")).toBe(false);
  });
});
