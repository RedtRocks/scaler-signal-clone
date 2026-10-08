import { describe, expect, it } from "vitest";
import type { ConversationSummary, Message } from "@/lib/types";
import { applyReceiptToLast, noteMessage, selectConversations, sortedIds } from "./conversationLogic";

const ME = 1;

function summary(id: number, overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    kind: "direct",
    title: `Chat ${id}`,
    avatar_url: null,
    peer: null,
    member_count: 2,
    last_message: null,
    last_message_at: null,
    unread_count: 0,
    muted: false,
    pinned: false,
    archived: false,
    left: false,
    disappearing_seconds: null,
    my_role: "member",
    ...overrides,
  };
}

function message(id: number, senderId: number, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversation_id: 1,
    client_id: null,
    sender_id: senderId,
    kind: "text",
    body: "hi",
    system_event: null,
    reply_to: null,
    created_at: "2026-10-08T10:00:00Z",
    expires_at: null,
    deleted: false,
    status: null,
    reactions: [],
    attachments: [],
    ...overrides,
  };
}

describe("sortedIds", () => {
  it("puts pinned first, then latest activity, then conversations without messages", () => {
    const byId = {
      1: summary(1, { last_message_at: "2026-10-08T09:00:00Z" }),
      2: summary(2, { last_message_at: "2026-10-08T11:00:00Z" }),
      3: summary(3, { last_message_at: "2026-10-01T09:00:00Z", pinned: true }),
      4: summary(4),
    };
    expect(sortedIds(byId)).toEqual([3, 2, 1, 4]);
  });
});

describe("noteMessage", () => {
  it("counts incoming text toward unread, and nothing twice", () => {
    const once = noteMessage(summary(1), message(5, 2), ME);
    expect(once.unread_count).toBe(1);
    expect(noteMessage(once, message(5, 2), ME)).toBe(once);
  });

  it("does not count my own or system messages", () => {
    expect(noteMessage(summary(1), message(5, ME), ME).unread_count).toBe(0);
    expect(noteMessage(summary(1), message(6, 2, { kind: "system" }), ME).unread_count).toBe(0);
  });

  it("replaces an optimistic preview with the stored message", () => {
    const pending = noteMessage(summary(1), message(-1, ME), ME);
    expect(noteMessage(pending, message(9, ME), ME).last_message?.id).toBe(9);
  });
});

describe("applyReceiptToLast", () => {
  it("updates the preview's ticks when the receipt covers it", () => {
    const withLast = summary(1, { last_message: message(5, ME, { status: "sent" }) });
    expect(applyReceiptToLast(withLast, { conversation_id: 1, message_ids: [5], status: "read" }).last_message?.status).toBe(
      "read",
    );
    expect(applyReceiptToLast(withLast, { conversation_id: 1, message_ids: [4], status: "read" })).toBe(withLast);
  });
});

describe("selectConversations", () => {
  const byId = {
    1: summary(1, { title: "Family", unread_count: 2 }),
    2: summary(2, { title: "Rock climbers" }),
    3: summary(3, { title: "Old stuff", archived: true }),
  };
  const order = [1, 2, 3];
  const titles = (list: ConversationSummary[]) => list.map((c) => c.title);

  it("filters by tab", () => {
    expect(titles(selectConversations(order, byId, "inbox", ""))).toEqual(["Family", "Rock climbers"]);
    expect(titles(selectConversations(order, byId, "unread", ""))).toEqual(["Family"]);
    expect(titles(selectConversations(order, byId, "archived", ""))).toEqual(["Old stuff"]);
  });

  it("matches the query against titles, ignoring case", () => {
    expect(titles(selectConversations(order, byId, "inbox", " rock "))).toEqual(["Rock climbers"]);
  });
});
