import { beforeEach, describe, expect, it, vi } from "vitest";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", fakeStorage());
    vi.stubGlobal("window", { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
  });

  it("returns defaults, then the written value", async () => {
    const { readPreference, writePreference } = await import("./preferences");
    expect(readPreference("enterSends")).toBe(true);
    writePreference("enterSends", false);
    expect(readPreference("enterSends")).toBe(false);
    expect(readPreference("notifySound")).toBe(true);
  });

  it("ignores corrupt stored JSON", async () => {
    localStorage.setItem("signal.prefs", "{nope");
    const { readPreference } = await import("./preferences");
    expect(readPreference("enterSends")).toBe(true);
  });
});
