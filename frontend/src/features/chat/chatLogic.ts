// Pure helpers for the conversation screen. No React, no store.
import type { ReactionSummary, SenderColor } from "@/components/ui";
import { formatLastSeen, formatTimer } from "@/lib/format";
import type { Id, Message, Reaction } from "@/lib/types";

const SENDER_COLORS: SenderColor[] = ["green", "indigo", "crimson", "teal", "orange"];

/** A stable colour per sender, so a Member keeps their colour in every message and quote. */
export function senderColor(userId: Id | null): SenderColor {
  return SENDER_COLORS[Math.abs(userId ?? 0) % SENDER_COLORS.length];
}

/** One chip per emoji with its count; `mine` marks the emoji the signed-in user chose. */
export function summarizeReactions(reactions: readonly Reaction[], meId: Id | undefined): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const { emoji, user_id } of reactions) {
    const entry = byEmoji.get(emoji) ?? { emoji, count: 0, mine: false };
    entry.count += 1;
    entry.mine = entry.mine || user_id === meId;
    byEmoji.set(emoji, entry);
  }
  return [...byEmoji.values()];
}

export function myReaction(reactions: readonly Reaction[], meId: Id | undefined): string | undefined {
  return reactions.find((reaction) => reaction.user_id === meId)?.emoji;
}

/**
 * The message that opens the "N unread messages" divider: walking back from the
 * newest message, the `unreadCount`-th incoming, visible text message.
 */
export function firstUnreadMessageId(messages: readonly Message[], meId: Id | undefined, unreadCount: number): Id | undefined {
  if (unreadCount <= 0 || meId === undefined) return undefined;
  let remaining = unreadCount;
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.kind !== "text" || message.deleted || message.sender_id === meId) continue;
    if (--remaining === 0) return message.id;
  }
  return undefined;
}

/** Header sentence for who is typing: "typing…", "Maya is typing…", "Maya and Kai are typing…". */
export function typingText(names: readonly string[], isGroup: boolean): string | undefined {
  if (names.length === 0) return undefined;
  if (!isGroup) return "typing…";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

interface SubtitleInput {
  isGroup: boolean;
  memberCount: number;
  left: boolean;
  online: boolean;
  lastSeenAt: string | null;
  typing: string | undefined;
  timerSeconds: number | null;
}

/** Desktop header subtitle: typing wins, then presence (direct) or member count (group), plus the timer. */
export function headerSubtitle(input: SubtitleInput, now: Date = new Date()): string {
  if (input.typing) return input.typing;
  const base = input.isGroup
    ? input.left
      ? "You left this group"
      : `${input.memberCount} ${input.memberCount === 1 ? "member" : "members"}`
    : formatLastSeen(input.online, input.lastSeenAt, now);
  return input.timerSeconds ? `${base} · ${formatTimer(input.timerSeconds)}` : base;
}

/** The choices of the disappearing-messages setting, in seconds (null = off). */
export const TIMER_CHOICES: (number | null)[] = [null, 30, 300, 3_600, 28_800, 86_400, 604_800];

/** Whether a message can still be deleted for everyone: mine, stored, not already deleted. */
export function canDeleteForEveryone(message: Message, meId: Id | undefined): boolean {
  return message.kind === "text" && message.sender_id === meId && message.id > 0 && !message.deleted;
}

/** Messages (oldest first) whose text contains the query, case-insensitively. */
export function findMatches(messages: readonly Message[], query: string): Id[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return messages
    .filter(
      (message) =>
        message.kind === "text" &&
        !message.deleted &&
        (message.body.toLowerCase().includes(needle) ||
          message.attachments.some((attachment) => attachment.file_name.toLowerCase().includes(needle))),
    )
    .map((message) => message.id);
}

/** Twelve groups of five digits, derived from both ids so it is stable per pair (mocked safety number). */
export function safetyNumber(a: Id, b: Id): string[] {
  let seed = (Math.min(a, b) * 7919 + Math.max(a, b) * 104729) >>> 0;
  return Array.from({ length: 12 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return String(seed % 100_000).padStart(5, "0");
  });
}
