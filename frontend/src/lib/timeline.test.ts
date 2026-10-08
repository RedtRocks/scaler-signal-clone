import { describe, expect, it } from "vitest";
import { buildTimeline, type BubbleItem } from "./timeline";
import type { Message } from "./types";

const ME = 1;
let nextId = 1;

function message(senderId: number | null, time: string, overrides: Partial<Message> = {}): Message {
  const id = nextId++;
  return {
    id,
    conversation_id: 10,
    client_id: null,
    sender_id: senderId,
    kind: "text",
    body: `message ${id}`,
    system_event: null,
    reply_to: null,
    created_at: new Date(time).toISOString(),
    expires_at: null,
    deleted: false,
    status: null,
    reactions: [],
    attachments: [],
    ...overrides,
  };
}

const bubbles = (items: ReturnType<typeof buildTimeline>) =>
  items.filter((item): item is BubbleItem => item.kind === "bubble");

describe("buildTimeline", () => {
  it("returns nothing for no messages", () => {
    expect(buildTimeline([], ME, false)).toEqual([]);
  });

  it("starts each day with a divider", () => {
    const items = buildTimeline(
      [message(2, "2026-10-07T10:00"), message(2, "2026-10-07T10:01"), message(2, "2026-10-08T10:00")],
      ME,
      false,
    );
    expect(items.map((item) => item.kind)).toEqual(["day", "bubble", "bubble", "day", "bubble"]);
  });

  it("groups a sender's messages within three minutes into one run", () => {
    const items = bubbles(
      buildTimeline(
        [
          message(2, "2026-10-08T10:00"),
          message(2, "2026-10-08T10:02"),
          message(2, "2026-10-08T10:05"),
          message(2, "2026-10-08T10:09"), // 4 minutes later: a new run
        ],
        ME,
        false,
      ),
    );
    expect(items.map((bubble) => bubble.position)).toEqual(["first", "middle", "last", "single"]);
  });

  it("splits runs on a change of sender, a system notice, or a new day", () => {
    const items = bubbles(
      buildTimeline(
        [
          message(ME, "2026-10-08T23:58"),
          message(2, "2026-10-08T23:58"),
          message(2, "2026-10-08T23:59"),
          message(2, "2026-10-08T23:59", { kind: "system", system_event: { type: "member_left" } }),
          message(2, "2026-10-08T23:59"),
          message(2, "2026-10-09T00:00"),
        ],
        ME,
        false,
      ),
    );
    expect(items.map((bubble) => [bubble.direction, bubble.position])).toEqual([
      ["outgoing", "single"],
      ["incoming", "first"],
      ["incoming", "last"],
      ["incoming", "single"],
      ["incoming", "single"],
    ]);
  });

  it("shows sender names and avatars only on incoming group runs", () => {
    const messages = [
      message(2, "2026-10-08T10:00"),
      message(2, "2026-10-08T10:01"),
      message(2, "2026-10-08T10:02"),
      message(ME, "2026-10-08T10:03"),
    ];
    const flags = (isGroup: boolean) =>
      bubbles(buildTimeline(messages, ME, isGroup)).map(({ showSender, showAvatar }) => [showSender, showAvatar]);

    expect(flags(true)).toEqual([
      [true, false],
      [false, false],
      [false, true],
      [false, false],
    ]);
    expect(flags(false).flat().every((flag) => flag === false)).toBe(true);
  });

  it("keys bubbles by client id so an optimistic bubble keeps its key once stored", () => {
    const pending = message(ME, "2026-10-08T10:00", { id: -1, client_id: "abc" });
    const stored = { ...pending, id: 99 };
    const [, before] = buildTimeline([pending], ME, false);
    const [, after] = buildTimeline([stored], ME, false);
    expect(before.key).toBe(after.key);
  });
});
