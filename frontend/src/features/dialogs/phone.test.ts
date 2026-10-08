import { describe, expect, it } from "vitest";
import { looksLikePhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("keeps a full international number", () => {
    expect(normalizePhone("+1 (555) 000-0002")).toBe("+15550000002");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("prepends the default country code", () => {
    expect(normalizePhone("555 000 0002")).toBe("+15550000002");
    expect(normalizePhone("98765 43210", "+91")).toBe("+919876543210");
  });
  it("rejects names and numbers of the wrong length", () => {
    expect(normalizePhone("Maya")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });
});

describe("looksLikePhone", () => {
  it("separates numbers from names", () => {
    expect(looksLikePhone("+1555")).toBe(true);
    expect(looksLikePhone("555 000")).toBe(true);
    expect(looksLikePhone("Maya")).toBe(false);
    expect(looksLikePhone("12")).toBe(false);
  });
});
