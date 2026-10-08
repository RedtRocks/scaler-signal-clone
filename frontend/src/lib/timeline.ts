import { isSameDay } from "./format";
import type { Id, IsoTime, Message } from "./types";

/** Consecutive messages from one sender within this gap join into one run. */
export const RUN_GAP_MS = 3 * 60_000;

export type BubblePosition = "single" | "first" | "middle" | "last";

export interface DayDividerItem {
  kind: "day";
  key: string;
  /** Time of the first message that day; format it with formatDayDivider. */
  at: IsoTime;
}

export interface SystemItem {
  kind: "system";
  key: string;
  message: Message;
}

export interface BubbleItem {
  kind: "bubble";
  key: string;
  message: Message;
  direction: "incoming" | "outgoing";
  position: BubblePosition;
  /** Group chats: the sender's name above the first bubble of an incoming run. */
  showSender: boolean;
  /** Group chats: the sender's avatar beside the last bubble of an incoming run. */
  showAvatar: boolean;
}

export type TimelineItem = DayDividerItem | SystemItem | BubbleItem;

/** Stable across the optimistic → stored swap, so React keeps the same bubble. */
export function messageKey(message: Message): string {
  return message.client_id ? `c:${message.client_id}` : `m:${message.id}`;
}

function positionInRun(index: number, length: number): BubblePosition {
  if (length === 1) return "single";
  if (index === 0) return "first";
  return index === length - 1 ? "last" : "middle";
}

function continuesRun(previous: Message, next: Message): boolean {
  const gap = new Date(next.created_at).getTime() - new Date(previous.created_at).getTime();
  return previous.sender_id === next.sender_id && gap <= RUN_GAP_MS;
}

function finishRun(run: BubbleItem[], isGroup: boolean): void {
  run.forEach((bubble, index) => {
    const incomingInGroup = isGroup && bubble.direction === "incoming";
    bubble.position = positionInRun(index, run.length);
    bubble.showSender = incomingInGroup && index === 0;
    bubble.showAvatar = incomingInGroup && index === run.length - 1;
  });
}

/**
 * Turns oldest-first messages into render items: a divider per day, system
 * notices, and bubbles grouped Signal-style. Day changes and system notices end a run.
 */
export function buildTimeline(messages: readonly Message[], meId: Id | undefined, isGroup: boolean): TimelineItem[] {
  const items: TimelineItem[] = [];
  let run: BubbleItem[] = [];
  const endRun = () => {
    finishRun(run, isGroup);
    run = [];
  };

  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    if (!previous || !isSameDay(previous.created_at, message.created_at)) {
      endRun();
      items.push({ kind: "day", key: `day:${message.created_at}`, at: message.created_at });
    }

    if (message.kind === "system") {
      endRun();
      items.push({ kind: "system", key: messageKey(message), message });
      return;
    }

    const last = run[run.length - 1];
    if (last && !continuesRun(last.message, message)) endRun();
    const bubble: BubbleItem = {
      kind: "bubble",
      key: messageKey(message),
      message,
      direction: message.sender_id === meId ? "outgoing" : "incoming",
      position: "single",
      showSender: false,
      showAvatar: false,
    };
    run.push(bubble);
    items.push(bubble);
  });

  endRun();
  return items;
}
