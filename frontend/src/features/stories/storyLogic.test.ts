import { describe, expect, it } from "vitest";
import type { Story, UserPublic } from "@/lib/types";
import { firstUnviewedIndex, groupStories, storyAge, storyPhotoProblem } from "./storyLogic";

const user = (id: number): UserPublic => ({ id, phone: `+1${id}`, display_name: `U${id}`, about: null, avatar_url: null, online: false, last_seen_at: null });
const story = (id: number, author: number, viewed: boolean, at: string): Story => ({
  id, author: user(author), body: "x", background: "ink", created_at: at, expires_at: at, viewed, views: null,
});

describe("groupStories", () => {
  it("splits mine, unviewed and viewed, oldest first inside a group", () => {
    const list = [
      story(5, 3, true, "2026-10-08T12:00:00Z"),
      story(4, 2, false, "2026-10-08T11:00:00Z"),
      story(3, 1, true, "2026-10-08T10:00:00Z"),
      story(2, 2, true, "2026-10-08T09:00:00Z"),
    ];
    const { mine, unviewed, viewed } = groupStories(list, 1);
    expect(mine.map((s) => s.id)).toEqual([3]);
    expect(unviewed.map((g) => g.author.id)).toEqual([2]);
    expect(unviewed[0].stories.map((s) => s.id)).toEqual([2, 4]);
    expect(viewed.map((g) => g.author.id)).toEqual([3]);
  });
});

describe("firstUnviewedIndex", () => {
  it("starts at the first unseen story, or the start when all are seen", () => {
    expect(firstUnviewedIndex([story(1, 2, true, ""), story(2, 2, false, "")])).toBe(1);
    expect(firstUnviewedIndex([story(1, 2, true, "")])).toBe(0);
  });
});

describe("storyAge", () => {
  it("formats minutes and hours", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(storyAge("2026-10-08T11:59:40Z", now)).toBe("Now");
    expect(storyAge("2026-10-08T11:45:00Z", now)).toBe("15m");
    expect(storyAge("2026-10-08T07:00:00Z", now)).toBe("5h");
  });
});

describe("storyPhotoProblem", () => {
  it("accepts pictures and explains refusals", () => {
    expect(storyPhotoProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(storyPhotoProblem({ type: "application/pdf", size: 1000 })).toMatch(/JPEG/);
    expect(storyPhotoProblem({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
});
