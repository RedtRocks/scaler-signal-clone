import type { Id } from "@/lib/types";

export type ShortcutId = "search" | "newChat" | "newGroup" | "settings" | "prevChat" | "nextChat" | "closeChat" | "help";

export interface Shortcut {
  id: ShortcutId;
  /** What the dialog shows, e.g. ["Ctrl", "K"]. `mod` is rendered as ⌘ on Apple platforms. */
  keys: string[];
  label: string;
}

/**
 * Browsers keep Ctrl/Cmd+N, +T, +W and +Shift+N for themselves and never let a page see them,
 * so the "new" shortcuts use Alt instead of Signal Desktop's Ctrl/Cmd.
 */
export const SHORTCUTS: Shortcut[] = [
  { id: "search", keys: ["mod", "K"], label: "Search chats" },
  { id: "newChat", keys: ["Alt", "N"], label: "New chat" },
  { id: "newGroup", keys: ["Alt", "G"], label: "New group" },
  { id: "settings", keys: ["Alt", "S"], label: "Settings" },
  { id: "prevChat", keys: ["Alt", "↑"], label: "Previous chat" },
  { id: "nextChat", keys: ["Alt", "↓"], label: "Next chat" },
  { id: "closeChat", keys: ["Esc"], label: "Close the open chat" },
  { id: "help", keys: ["?"], label: "Show keyboard shortcuts" },
];

/** The slice of a KeyboardEvent the matcher needs, so it can be tested without a DOM. */
export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Which shortcut a key press is, or null. Typing context is the caller's concern. */
export function matchShortcut(e: KeyInput): ShortcutId | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && !e.shiftKey && key === "k") return "search";
  if (e.altKey && !mod && !e.shiftKey) {
    if (key === "n" || key === "˜") return "newChat";
    if (key === "g" || key === "©") return "newGroup";
    if (key === "s" || key === "ß") return "settings";
    if (key === "ArrowUp") return "prevChat";
    if (key === "ArrowDown") return "nextChat";
  }
  if (!mod && !e.altKey && key === "Escape") return "closeChat";
  if (!mod && !e.altKey && key === "?") return "help";
  return null;
}

/** The conversation `delta` steps from `current` in list order, stopping at the ends. Starts from the top or bottom when none is open. */
export function neighbourId(order: Id[], current: Id | null, delta: 1 | -1): Id | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return delta === 1 ? order[0] : order[order.length - 1];
  return order[Math.min(order.length - 1, Math.max(0, index + delta))];
}

/** True when a key press is going into a text field, where bare keys such as "?" must type. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
