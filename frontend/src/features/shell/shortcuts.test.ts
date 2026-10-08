import { describe, expect, it } from "vitest";
import { matchShortcut, neighbourId, type KeyInput } from "./shortcuts";

const press = (key: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("matchShortcut", () => {
  it("matches Ctrl or Cmd+K as search", () => {
    expect(matchShortcut(press("k", { ctrlKey: true }))).toBe("search");
    expect(matchShortcut(press("K", { metaKey: true }))).toBe("search");
  });

  it("matches the Alt shortcuts, including the characters macOS types for Option+key", () => {
    expect(matchShortcut(press("n", { altKey: true }))).toBe("newChat");
    expect(matchShortcut(press("˜", { altKey: true }))).toBe("newChat");
    expect(matchShortcut(press("ArrowUp", { altKey: true }))).toBe("prevChat");
    expect(matchShortcut(press("ArrowDown", { altKey: true }))).toBe("nextChat");
  });

  it("matches bare Escape and ?, and nothing else", () => {
    expect(matchShortcut(press("Escape"))).toBe("closeChat");
    expect(matchShortcut(press("?", { shiftKey: true }))).toBe("help");
    expect(matchShortcut(press("a"))).toBeNull();
    expect(matchShortcut(press("k"))).toBeNull();
  });
});

describe("neighbourId", () => {
  const order = [5, 9, 2];
  it("moves through the list and stops at the ends", () => {
    expect(neighbourId(order, 9, 1)).toBe(2);
    expect(neighbourId(order, 9, -1)).toBe(5);
    expect(neighbourId(order, 2, 1)).toBe(2);
    expect(neighbourId(order, 5, -1)).toBe(5);
  });

  it("starts from the top going down and the bottom going up when no chat is open", () => {
    expect(neighbourId(order, null, 1)).toBe(5);
    expect(neighbourId(order, null, -1)).toBe(2);
    expect(neighbourId([], null, 1)).toBeNull();
  });
});
