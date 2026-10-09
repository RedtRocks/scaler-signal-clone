// Pure helpers for the (simulated) call screens and the Calls tab. No React, no store.
import type { ConversationSummary, Id, Member, UserPublic } from "@/lib/types";

export type CallKind = "voice" | "video";
export type CallDirection = "outgoing" | "incoming" | "missed";

export interface CallRecord {
  id: string;
  conversationId: Id;
  title: string;
  avatarUrl: string | null;
  isGroup: boolean;
  kind: CallKind;
  direction: CallDirection;
  /** ISO time the call started. */
  at: string;
  /** Seconds; absent for a missed call. */
  seconds?: number;
}

export interface Participant {
  id: Id;
  name: string;
  avatarUrl: string | null;
}

const toParticipant = (user: UserPublic, name?: string): Participant => ({
  id: user.id,
  name: name ?? (user.display_name || user.phone),
  avatarUrl: user.avatar_url,
});

/** Who is on the other end: the peer of a direct chat, or every other member of a group. */
export function participantsOf(
  conversation: Pick<ConversationSummary, "kind" | "peer" | "title" | "id">,
  members: readonly Pick<Member, "user">[] | undefined,
  meId: Id | undefined,
): Participant[] {
  if (conversation.kind === "direct") {
    return conversation.peer ? [toParticipant(conversation.peer, conversation.title)] : [];
  }
  return (members ?? []).filter((m) => m.user.id !== meId).map((m) => toParticipant(m.user));
}

/** "Paige", "Paige and John", "Paige, John and 14 others". */
export function callTitle(names: readonly string[]): string {
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length <= 1) return first[0] ?? "";
  if (first.length === 2) return `${first[0]} and ${first[1]}`;
  const others = first.length - 2;
  return `${first[0]}, ${first[1]} and ${others} ${others === 1 ? "other" : "others"}`;
}

/** Columns for a call grid: 1 person fills, 2 side by side, 3-4 two columns, 5-9 three. */
export function gridColumns(count: number, phone: boolean): number {
  if (count <= 1) return 1;
  if (phone) return 2;
  if (count === 2) return 2;
  return count <= 4 ? 2 : 3;
}

/** "0:07", "12:45", "1:02:03". */
export function callClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "12 minutes" style for the history rows: "42 sec", "5 min", "1 hr 3 min". */
export function callLength(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} hr ${rest} min` : `${Math.floor(minutes / 60)} hr`;
}

export function directionLabel(record: Pick<CallRecord, "direction" | "kind" | "seconds">): string {
  const noun = record.kind === "video" ? "Video call" : "Voice call";
  if (record.direction === "missed") return `Missed ${noun.toLowerCase()}`;
  const base = `${record.direction === "outgoing" ? "Outgoing" : "Incoming"} ${noun.toLowerCase()}`;
  return record.seconds ? `${base} · ${callLength(record.seconds)}` : base;
}

/** Some history for an account that has never called: derived from its chats so the tab isn't empty. */
export function demoHistory(conversations: readonly ConversationSummary[], now: Date): CallRecord[] {
  const patterns: Pick<CallRecord, "kind" | "direction" | "seconds">[] = [
    { kind: "video", direction: "incoming", seconds: 1260 },
    { kind: "voice", direction: "missed" },
    { kind: "voice", direction: "outgoing", seconds: 312 },
    { kind: "video", direction: "outgoing", seconds: 2710 },
    { kind: "voice", direction: "incoming", seconds: 48 },
  ];
  const hoursAgo = [3, 20, 30, 52, 96];
  return conversations
    .filter((c) => c.kind === "group" || c.peer)
    .slice(0, patterns.length)
    .map((c, i) => ({
      id: `demo-${c.id}-${i}`,
      conversationId: c.id,
      title: c.title,
      avatarUrl: c.avatar_url ?? c.peer?.avatar_url ?? null,
      isGroup: c.kind === "group",
      ...patterns[i],
      at: new Date(now.getTime() - hoursAgo[i] * 3_600_000).toISOString(),
    }));
}
