import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/types";
import {
  applyMessageUpdate,
  applyReceipt,
  createOptimisticMessage,
  latestIncomingId,
  mergePage,
  oldestStoredId,
  setPendingStatus,
  upsertMessage,
} from "./messageLogic";

const ME = 1;
const PEER = 2;

function stored(id: number, overrides: Partial<Message> = {}): Message {
  return {
    id,
    conversation_id: 10,
    client_id: `client-${id}`,
    sender_id: PEER,
    kind: "text",
    body: `message ${id}`,
    system_event: null,
    reply_to: null,
    created_at: "2026-10-08T10:00:00Z",
    expires_at: null,
    deleted: false,
    status: null,
    reactions: [],
    ...overrides,
  };
}

function optimistic(localId: number, clientId: string, replyTo: Message | null = null) {
  return createOptimisticMessage({
    localId,
    conversationId: 10,
    senderId: ME,
    clientId,
    body: "hello",
    replyTo,
    now: "2026-10-08T10:05:00.123Z",
  });
}

const ids = (list: Message[]) => list.map((message) => message.id);

describe("optimistic send reconciliation", () => {
  it("replaces the optimistic bubble with the stored message by client id", () => {
    const pending = optimistic(-1, "abc");
    const list = upsertMessage([stored(1), stored(2)], pending);
    expect(list.at(-1)?.status).toBe("sending");

    const reconciled = upsertMessage(list, stored(3, { client_id: "abc", sender_id: ME, status: "sent" }));
    expect(ids(reconciled)).toEqual([1, 2, 3]);
    expect(reconciled[2].status).toBe("sent");
  });

  it("moves the stored copy into id order ahead of other pending messages", () => {
    let list = upsertMessage([stored(1)], optimistic(-1, "first"));
    list = upsertMessage(list, optimistic(-2, "second"));
    list = upsertMessage(list, stored(5, { client_id: "first", sender_id: ME, status: "sent" }));
    expect(ids(list)).toEqual([1, 5, -2]);
  });

  it("does not match another sender's message that reuses a client id", () => {
    const list = upsertMessage([optimistic(-1, "same")], stored(7, { client_id: "same", sender_id: PEER }));
    expect(ids(list)).toEqual([7, -1]);
  });

  it("marks only the matching pending message failed, then sending again on retry", () => {
    const list = [stored(1), optimistic(-1, "abc"), optimistic(-2, "def")];
    const failed = setPendingStatus(list, "abc", "failed");
    expect(failed.map((m) => m.status)).toEqual([null, "failed", "sending"]);
    expect(setPendingStatus(failed, "abc", "sending")[1].status).toBe("sending");
  });

  it("copies the quoted message into reply_to", () => {
    const quoted = stored(4, { body: "original" });
    expect(optimistic(-1, "abc", quoted).reply_to).toEqual({
      id: 4,
      sender_id: PEER,
      body: "original",
      deleted: false,
    });
  });
});

describe("deduplication", () => {
  it("keeps one copy when the POST response and the message.new echo both arrive", () => {
    const pending = optimistic(-1, "abc");
    const server = stored(3, { client_id: "abc", sender_id: ME, status: "sent" });
    const list = upsertMessage(upsertMessage(upsertMessage([pending], server), server), { ...server });
    expect(ids(list)).toEqual([3]);
  });

  it("ignores repeated pushes of the same id", () => {
    const list = upsertMessage(upsertMessage([stored(1)], stored(2)), stored(2));
    expect(ids(list)).toEqual([1, 2]);
  });

  it("merges a newest-first page into oldest-first order without duplicates", () => {
    const list = mergePage([stored(4), stored(5)], [stored(5), stored(4), stored(3), stored(2)]);
    expect(ids(list)).toEqual([2, 3, 4, 5]);
  });

  it("inserts an out-of-order push into its id slot", () => {
    expect(ids(upsertMessage([stored(1), stored(3)], stored(2)))).toEqual([1, 2, 3]);
  });
});

describe("receipts and updates", () => {
  const mine = (id: number, status: Message["status"]) => stored(id, { sender_id: ME, status });

  it("applies a receipt to the listed ids only", () => {
    const list = applyReceipt([mine(1, "sent"), mine(2, "sent"), mine(3, "sent")], [1, 3], "delivered");
    expect(list.map((m) => m.status)).toEqual(["delivered", "sent", "delivered"]);
  });

  it("never moves a status backwards", () => {
    expect(applyReceipt([mine(1, "read")], [1], "delivered")[0].status).toBe("read");
    // A receipt beat the POST response, which still says "sent".
    expect(upsertMessage([mine(1, "read")], mine(1, "sent"))[0].status).toBe("read");
  });

  it("applies message.updated and refreshes replies that quote it", () => {
    const reply = stored(2, { reply_to: { id: 1, sender_id: PEER, body: "message 1", deleted: false } });
    const list = applyMessageUpdate([stored(1), reply], stored(1, { body: "", deleted: true }));
    expect(list[0].deleted).toBe(true);
    expect(list[1].reply_to).toEqual({ id: 1, sender_id: PEER, body: "", deleted: true });
  });

  it("ignores updates for messages that are not loaded", () => {
    const list = [stored(1)];
    expect(applyMessageUpdate(list, stored(9))).toBe(list);
  });
});

describe("cursors", () => {
  const list = [stored(4, { sender_id: PEER }), stored(5, { sender_id: ME }), optimistic(-1, "abc")];

  it("finds the oldest stored id for the next page", () => {
    expect(oldestStoredId(list)).toBe(4);
    expect(oldestStoredId([optimistic(-1, "abc")])).toBeUndefined();
  });

  it("finds the newest incoming text message to mark read", () => {
    expect(latestIncomingId(list, ME)).toBe(4);
    expect(latestIncomingId([stored(6, { kind: "system" })], ME)).toBeUndefined();
  });
});
