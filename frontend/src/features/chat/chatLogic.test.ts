import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/types";
import { formatTimer } from "@/lib/format";
import {
  canDeleteForEveryone,
  findMatches,
  firstUnreadMessageId,
  headerSubtitle,
  safetyNumber,
  senderColor,
  summarizeReactions,
  typingText,
} from "./chatLogic";

function msg(id: number, sender: number | null, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversation_id: 1,
    client_id: null,
    sender_id: sender,
    kind: "text",
    body: `m${id}`,
    system_event: null,
    reply_to: null,
    created_at: "2026-10-08T10:00:00Z",
    expires_at: null,
    deleted: false,
    status: null,
    reactions: [],
    attachments: [],
    ...extra,
  };
}

describe("firstUnreadMessageId", () => {
  const messages = [msg(1, 2), msg(2, 1), msg(3, 2), msg(4, 2, { kind: "system", sender_id: 2 }), msg(5, 2)];
  it("counts only incoming text messages back from the newest", () => {
    expect(firstUnreadMessageId(messages, 1, 2)).toBe(3);
    expect(firstUnreadMessageId(messages, 1, 3)).toBe(1);
  });
  it("is undefined with nothing unread or more unread than loaded", () => {
    expect(firstUnreadMessageId(messages, 1, 0)).toBeUndefined();
    expect(firstUnreadMessageId(messages, 1, 9)).toBeUndefined();
  });
});

describe("summarizeReactions", () => {
  it("groups by emoji and flags mine", () => {
    const out = summarizeReactions(
      [
        { emoji: "👍", user_id: 1 },
        { emoji: "👍", user_id: 2 },
        { emoji: "❤️", user_id: 3 },
      ],
      1,
    );
    expect(out).toEqual([
      { emoji: "👍", count: 2, mine: true },
      { emoji: "❤️", count: 1, mine: false },
    ]);
  });
});

describe("typing and subtitle", () => {
  it("words the typing line", () => {
    expect(typingText([], true)).toBeUndefined();
    expect(typingText(["Maya"], false)).toBe("typing…");
    expect(typingText(["Maya"], true)).toBe("Maya is typing…");
    expect(typingText(["Maya", "Kai"], true)).toBe("Maya and Kai are typing…");
  });
  const base = { isGroup: false, memberCount: 2, left: false, online: true, lastSeenAt: null, typing: undefined, timerSeconds: null };
  it("prefers typing, then presence or member count, then adds the timer", () => {
    expect(headerSubtitle({ ...base, typing: "typing…" })).toBe("typing…");
    expect(headerSubtitle(base)).toBe("online");
    expect(headerSubtitle({ ...base, isGroup: true, memberCount: 4 })).toBe("4 members");
    expect(headerSubtitle({ ...base, isGroup: true, left: true })).toBe("You left this group");
    expect(headerSubtitle({ ...base, timerSeconds: 3600 })).toBe("online · 1 hour");
  });
});

describe("misc", () => {
  it("keeps a sender's colour stable", () => {
    expect(senderColor(7)).toBe(senderColor(7));
  });
  it("allows delete-for-everyone only on my stored, live text", () => {
    expect(canDeleteForEveryone(msg(5, 1), 1)).toBe(true);
    expect(canDeleteForEveryone(msg(5, 2), 1)).toBe(false);
    expect(canDeleteForEveryone(msg(-1, 1), 1)).toBe(false);
    expect(canDeleteForEveryone(msg(5, 1, { deleted: true }), 1)).toBe(false);
  });
  it("finds matches case-insensitively among visible text", () => {
    const list = [msg(1, 2, { body: "Hello World" }), msg(2, 2, { body: "bye", deleted: true }), msg(3, 1, { body: "world" })];
    expect(findMatches(list, " WORLD ")).toEqual([1, 3]);
    expect(findMatches(list, "")).toEqual([]);
  });
  it("makes the same safety number for either direction", () => {
    expect(safetyNumber(1, 2)).toEqual(safetyNumber(2, 1));
    expect(safetyNumber(1, 2)).toHaveLength(12);
  });
});

describe("headerSubtitle for Note to Self", () => {
  it("has no presence line, only the timer when set", () => {
    const base = { isGroup: false, memberCount: 1, left: false, online: false, lastSeenAt: null, typing: undefined, note: true };
    expect(headerSubtitle({ ...base, timerSeconds: null })).toBe("");
    expect(headerSubtitle({ ...base, timerSeconds: 3600 })).toBe(formatTimer(3600));
  });
});
