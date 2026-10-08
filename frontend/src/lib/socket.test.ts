import { describe, expect, it } from "vitest";
import { backoffDelay } from "./socket";

describe("backoffDelay", () => {
  it("doubles per attempt with jitter in the upper half", () => {
    expect(backoffDelay(0, () => 0)).toBe(250);
    expect(backoffDelay(0, () => 1)).toBe(500);
    expect(backoffDelay(3, () => 0)).toBe(2_000);
  });

  it("caps at 10 seconds", () => {
    expect(backoffDelay(20, () => 1)).toBe(10_000);
    expect(backoffDelay(20, () => 0)).toBe(5_000);
  });
});
