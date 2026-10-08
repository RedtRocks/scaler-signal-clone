import { describe, expect, it } from "vitest";
import type { Message } from "@/lib/types";
import { rowPreview } from "./preview";

const msg = (patch: Partial<Message>): Message => ({
  id: 1,
  conversation_id: 1,
  client_id: null,
  sender_id: 2,
  kind: "text",
  body: "hello",
  system_event: null,
  reply_to: null,
  created_at: "2026-10-08T13:00:00Z",
  expires_at: null,
  deleted: false,
  status: null,
  reactions: [],
  ...patch,
});
const nameOf = (id: number) => (id === 2 ? "Kai" : "");

describe("rowPreview", () => {
  it("shows plain text in a direct chat, with status only on my own", () => {
    expect(rowPreview({ kind: "direct" }, msg({}), 1, nameOf)).toEqual({ text: "hello", sender: undefined, status: undefined });
    expect(rowPreview({ kind: "direct" }, msg({ sender_id: 1, status: "read" }), 1, nameOf).status).toBe("read");
  });
  it("prefixes the sender in groups", () => {
    expect(rowPreview({ kind: "group" }, msg({}), 1, nameOf).sender).toBe("Kai");
    expect(rowPreview({ kind: "group" }, msg({ sender_id: 1 }), 1, nameOf).sender).toBe("You");
    expect(rowPreview({ kind: "group" }, msg({ sender_id: 9 }), 1, nameOf).sender).toBeUndefined();
  });
  it("words deleted and system messages", () => {
    expect(rowPreview({ kind: "direct" }, msg({ deleted: true, body: "" }), 1, nameOf).text).toBe("This message was deleted");
    const system = msg({ kind: "system", sender_id: 1, body: "", system_event: { type: "group_created" } });
    expect(rowPreview({ kind: "group" }, system, 1, nameOf).text).toBe("You created the group.");
  });
  it("hides failed status and handles no message", () => {
    expect(rowPreview({ kind: "direct" }, msg({ sender_id: 1, status: "failed" }), 1, nameOf).status).toBeUndefined();
    expect(rowPreview({ kind: "direct" }, null, 1, nameOf).text).toBe("");
  });
});
