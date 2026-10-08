import { describe, expect, it } from "vitest";
import {
  formatBubbleTime,
  formatDayDivider,
  formatLastSeen,
  formatListTime,
  formatTimer,
  initials,
  systemEventText,
} from "./format";
import type { SystemEvent } from "./types";

// Built from local-time parts, so the tests pass in any time zone.
const local = (month: number, day: number, hour = 12, minute = 0, year = 2026) =>
  new Date(year, month - 1, day, hour, minute);
const iso = (date: Date) => date.toISOString();

// Thursday, Oct 8 2026, 2:00 PM.
const now = local(10, 8, 14, 0);

describe("formatListTime", () => {
  it.each([
    ["under a minute", local(10, 8, 13, 59).getTime() + 30_000, "Now"],
    ["minutes", local(10, 8, 13, 35).getTime(), "25m"],
    ["earlier today", local(10, 8, 9, 24).getTime(), "9:24 AM"],
    ["midnight hour", local(10, 8, 0, 5).getTime(), "12:05 AM"],
    ["within six days", local(10, 2, 18, 0).getTime(), "Fri"],
    ["older this year", local(10, 1, 9, 0).getTime(), "Oct 1"],
    ["another year", local(10, 6, 9, 0, 2025).getTime(), "Oct 6, 2025"],
  ])("%s", (_case, time, expected) => {
    expect(formatListTime(iso(new Date(time)), now)).toBe(expected);
  });
});

describe("formatBubbleTime", () => {
  it("uses the clock once past the hour, whatever the day", () => {
    expect(formatBubbleTime(iso(local(10, 8, 13, 50)), now)).toBe("10m");
    expect(formatBubbleTime(iso(local(10, 1, 15, 7)), now)).toBe("3:07 PM");
  });
});

describe("formatDayDivider", () => {
  it.each([
    [local(10, 8, 1, 0), "Today"],
    [local(10, 7, 23, 0), "Yesterday"],
    [local(10, 5, 9, 0), "Monday"],
    [local(10, 1, 9, 0), "Thu, Oct 1"],
    [local(10, 6, 9, 0, 2025), "Mon, Oct 6, 2025"],
  ])("%s → %s", (date, expected) => {
    expect(formatDayDivider(iso(date), now)).toBe(expected);
  });
});

describe("formatLastSeen", () => {
  it.each([
    [true, null, "online"],
    [false, null, "offline"],
    [false, iso(local(10, 8, 13, 55)), "last seen 5m ago"],
    [false, iso(local(10, 8, 9, 24)), "last seen today at 9:24 AM"],
    [false, iso(local(10, 7, 9, 24)), "last seen yesterday at 9:24 AM"],
    [false, iso(local(10, 5, 9, 24)), "last seen Mon at 9:24 AM"],
    [false, iso(local(9, 20, 9, 24)), "last seen Sep 20"],
  ] as const)("online=%s, %s → %s", (online, lastSeen, expected) => {
    expect(formatLastSeen(online, lastSeen, now)).toBe(expected);
  });
});

describe("formatTimer", () => {
  it.each([
    [null, "Off"],
    [0, "Off"],
    [30, "30 seconds"],
    [300, "5 minutes"],
    [3600, "1 hour"],
    [5400, "90 minutes"],
    [86_400, "1 day"],
    [604_800, "1 week"],
  ])("%s → %s", (seconds, expected) => {
    expect(formatTimer(seconds)).toBe(expected);
  });
});

describe("systemEventText", () => {
  const names: Record<number, string> = { 2: "Maya", 3: "Kai", 4: "Leo" };
  const nameOf = (id: number) => names[id];
  const me = 1;

  it.each<[SystemEvent, number, string]>([
    [{ type: "group_created" }, me, "You created the group."],
    [{ type: "members_added", user_ids: [3] }, 2, "Maya added Kai."],
    [{ type: "members_added", user_ids: [me, 3, 4] }, 2, "Maya added you, Kai, and Leo."],
    [{ type: "member_removed", user_id: 3 }, me, "You removed Kai."],
    [{ type: "member_left" }, 3, "Kai left the group."],
    [{ type: "admin_granted", user_id: me }, 2, "Maya made you an admin."],
    [{ type: "renamed", name: "Rock climbers" }, 2, "Maya changed the group name to “Rock climbers”."],
    [{ type: "timer_changed", seconds: 3600 }, me, "You set disappearing message time to 1 hour."],
    [{ type: "timer_changed", seconds: null }, 3, "Kai disabled disappearing messages."],
  ])("%o by %s", (event, actor, expected) => {
    expect(systemEventText(event, actor, me, nameOf)).toBe(expected);
  });
});

describe("initials", () => {
  it.each([
    ["Aarav Dudeja", "AD"],
    ["maya", "M"],
    ["  Kai  Lee Park ", "KP"],
    ["", ""],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
