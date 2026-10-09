// Pure helpers for the Stories tab. No React, no store.
import type { Id, Story, StoryBackground, UserPublic } from "@/lib/types";

export const STORY_BACKGROUNDS: StoryBackground[] = ["ultramarine", "crimson", "forest", "plum", "sunset", "ink"];
export const STORY_MAX_LENGTH = 700;
/** How long one story stays on screen in the viewer. */
export const STORY_DURATION_MS = 5000;

/** One author's unexpired stories, oldest first (the order the viewer plays them). */
export interface StoryGroup {
  author: UserPublic;
  stories: Story[];
  /** True when every story in the group was viewed. */
  viewed: boolean;
  latestAt: string;
}

/** Splits the server list (newest first) into my stories and other people's groups.
 * Others: unviewed groups first, then viewed, each newest first. */
export function groupStories(stories: readonly Story[], meId: Id | undefined) {
  const byAuthor = new Map<Id, StoryGroup>();
  for (const story of [...stories].reverse()) {
    const group = byAuthor.get(story.author.id) ?? { author: story.author, stories: [], viewed: true, latestAt: story.created_at };
    group.stories.push(story);
    group.viewed = group.viewed && story.viewed;
    group.latestAt = story.created_at;
    byAuthor.set(story.author.id, group);
  }
  const mine = meId === undefined ? undefined : byAuthor.get(meId);
  const others = [...byAuthor.values()].filter((g) => g.author.id !== meId);
  const newestFirst = (a: StoryGroup, b: StoryGroup) => b.latestAt.localeCompare(a.latestAt);
  return {
    mine: mine?.stories ?? [],
    unviewed: others.filter((g) => !g.viewed).sort(newestFirst),
    viewed: others.filter((g) => g.viewed).sort(newestFirst),
  };
}

/** Where the viewer should start in a group: the first story not yet viewed. */
export function firstUnviewedIndex(group: readonly Story[]): number {
  const index = group.findIndex((s) => !s.viewed);
  return index === -1 ? 0 : index;
}

/** "Now", "5m", "3h" — Signal's short age label for a story. */
export function storyAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/** Pictures a photo story accepts (the server checks the bytes too). */
export const STORY_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const STORY_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Why a picture can't be a story, or null when it can. */
export function storyPhotoProblem(file: { type: string; size: number }): string | null {
  if (!STORY_PHOTO_TYPES.includes(file.type)) return "Choose a JPEG, PNG, WebP or GIF picture.";
  if (file.size > STORY_PHOTO_MAX_BYTES) return "Pictures must be 10 MB or smaller.";
  return null;
}
