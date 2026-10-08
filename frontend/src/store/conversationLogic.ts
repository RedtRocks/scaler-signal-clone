// Pure helpers behind the conversations store.
import type { ConversationSummary, Id, Message, ReceiptEvent } from "@/lib/types";
import { applyReceipt, isPending, upsertMessage } from "./messageLogic";

export type ConversationFilter = "inbox" | "unread" | "archived";

// Parsed, not string-compared: optimistic times carry milliseconds, server times do not.
const activityTime = (conversation: ConversationSummary) =>
  conversation.last_message_at ? Date.parse(conversation.last_message_at) : 0;

/** Pinned first, then latest activity first; conversations without messages go last. */
export function compareConversations(a: ConversationSummary, b: ConversationSummary): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return activityTime(b) - activityTime(a) || b.id - a.id;
}

export function sortedIds(byId: Record<Id, ConversationSummary>): Id[] {
  return Object.values(byId)
    .sort(compareConversations)
    .map((conversation) => conversation.id);
}

/** What counts toward the Unread count (CONTEXT.md). */
function countsAsUnread(message: Message, meId: Id): boolean {
  return message.kind === "text" && message.sender_id !== meId && !message.deleted;
}

function isNewerThanLast(summary: ConversationSummary, message: Message): boolean {
  const last = summary.last_message;
  return !last || isPending(last) || isPending(message) || message.id > last.id;
}

/** Updates preview, activity time and unread count for a new message. Ignores repeats. */
export function noteMessage(summary: ConversationSummary, message: Message, meId: Id): ConversationSummary {
  if (!isNewerThanLast(summary, message)) return summary;
  return {
    ...summary,
    last_message: message,
    last_message_at: message.created_at,
    unread_count: summary.unread_count + (countsAsUnread(message, meId) ? 1 : 0),
  };
}

/** Keeps the list preview in step with message.updated (reactions, delete, expiry). */
export function refreshLastMessage(summary: ConversationSummary, updated: Message): ConversationSummary {
  const last = summary.last_message;
  if (last?.id !== updated.id) return summary;
  return { ...summary, last_message: upsertMessage([last], updated)[0] };
}

export function applyReceiptToLast(summary: ConversationSummary, receipt: ReceiptEvent): ConversationSummary {
  const last = summary.last_message;
  if (!last || !receipt.message_ids.includes(last.id)) return summary;
  const [updated] = applyReceipt([last], receipt.message_ids, receipt.status);
  return { ...summary, last_message: updated };
}

function matchesFilter(conversation: ConversationSummary, filter: ConversationFilter): boolean {
  if (filter === "archived") return conversation.archived;
  if (filter === "unread") return !conversation.archived && conversation.unread_count > 0;
  return !conversation.archived;
}

/** The list a screen shows: filter, then a case-insensitive title match. */
export function selectConversations(
  ids: Id[],
  byId: Record<Id, ConversationSummary>,
  filter: ConversationFilter,
  query: string,
): ConversationSummary[] {
  const needle = query.trim().toLowerCase();
  return ids
    .map((id) => byId[id])
    .filter((conversation) => matchesFilter(conversation, filter))
    .filter((conversation) => !needle || conversation.title.toLowerCase().includes(needle));
}
