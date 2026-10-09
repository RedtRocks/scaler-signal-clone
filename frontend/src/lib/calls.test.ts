import { describe, expect, it } from "vitest";
import type { ConversationSummary, UserPublic } from "@/lib/types";
import { callClock, callLength, callTitle, demoHistory, directionLabel, gridColumns, participantsOf } from "./calls";

const user = (id: number, name: string): UserPublic => ({
  id,
  phone: `+1555000000${id}`,
  display_name: name,
  about: null,
  avatar_url: null,
  online: false,
  last_seen_at: null,
});

describe("callTitle", () => {
  it("names one, two or many", () => {
    expect(callTitle(["Paige Hall"])).toBe("Paige");
    expect(callTitle(["Paige Hall", "John Lee"])).toBe("Paige and John");
    expect(callTitle(["Paige Hall", "John Lee", "Kai"])).toBe("Paige, John and 1 other");
    expect(callTitle(Array.from({ length: 16 }, (_, i) => (i === 0 ? "Paige" : i === 1 ? "John" : `P${i}`)))).toBe(
      "Paige, John and 14 others",
    );
  });
});

describe("gridColumns", () => {
  it("scales with people", () => {
    expect(gridColumns(1, false)).toBe(1);
    expect(gridColumns(2, false)).toBe(2);
    expect(gridColumns(4, false)).toBe(2);
    expect(gridColumns(6, false)).toBe(3);
    expect(gridColumns(6, true)).toBe(2);
  });
});

describe("clocks and labels", () => {
  it("formats the running time", () => {
    expect(callClock(7)).toBe("0:07");
    expect(callClock(754)).toBe("12:34");
    expect(callClock(3723)).toBe("1:02:03");
  });
  it("formats the length of a past call", () => {
    expect(callLength(42)).toBe("42 sec");
    expect(callLength(300)).toBe("5 min");
    expect(callLength(3780)).toBe("1 hr 3 min");
  });
  it("describes a record", () => {
    expect(directionLabel({ direction: "missed", kind: "voice" })).toBe("Missed voice call");
    expect(directionLabel({ direction: "outgoing", kind: "video", seconds: 300 })).toBe("Outgoing video call · 5 min");
  });
});

describe("participantsOf", () => {
  it("uses the peer of a direct chat and everyone but me in a group", () => {
    const direct = { id: 1, kind: "direct", title: "Maya Patel", peer: user(2, "Maya P") } as ConversationSummary;
    expect(participantsOf(direct, undefined, 1).map((p) => p.name)).toEqual(["Maya Patel"]);
    const group = { id: 2, kind: "group", title: "Crew", peer: null } as ConversationSummary;
    const members = [user(1, "Me"), user(2, "Kai"), user(3, "Zoe")].map((u) => ({ user: u }));
    expect(participantsOf(group, members, 1).map((p) => p.name)).toEqual(["Kai", "Zoe"]);
  });
});

describe("demoHistory", () => {
  it("builds one record per chat, newest first", () => {
    const chats = [1, 2, 3].map((id) => ({ id, kind: "direct", title: `C${id}`, peer: user(id, `C${id}`), avatar_url: null }) as ConversationSummary);
    const history = demoHistory(chats, new Date("2026-10-09T12:00:00Z"));
    expect(history).toHaveLength(3);
    expect(history[0].at > history[1].at).toBe(true);
  });
});
