// Pure list operations behind the messages store. Lists are oldest-first:
// stored messages in id order, then optimistic ones (negative ids) in send order.
import type { Id, IsoTime, Message, MessageStatus, ServerMessageStatus } from "@/lib/types";

const STATUS_RANK: Record<MessageStatus, number> = { failed: 0, sending: 0, sent: 1, delivered: 2, read: 3 };

/** An optimistic message: not stored yet, so it always has its client id. */
export type PendingMessage = Message & { client_id: string };

export const isPending = (message: Message): message is PendingMessage => message.id < 0;

/** Statuses only move forward: a socket receipt can beat the POST response that says "sent". */
function strongerStatus(current: MessageStatus | null, next: MessageStatus | null): MessageStatus | null {
  if (!current || !next) return next ?? current;
  return STATUS_RANK[next] >= STATUS_RANK[current] ? next : current;
}

function isSameMessage(a: Message, b: Message): boolean {
  if (a.id === b.id) return true;
  return a.client_id !== null && a.client_id === b.client_id && a.sender_id === b.sender_id;
}

/** Index where a stored message belongs: after every smaller id, before any optimistic one. */
function insertionIndex(list: Message[], id: Id): number {
  let index = list.length;
  while (index > 0 && (isPending(list[index - 1]) || list[index - 1].id > id)) index--;
  return index;
}

/**
 * Adds or replaces one message. Matches on id, or on client_id from the same
 * sender, which is how an optimistic bubble meets its stored copy (from the
 * POST response or the message.new echo, whichever comes first).
 */
export function upsertMessage(list: Message[], incoming: Message): Message[] {
  const index = list.findIndex((message) => isSameMessage(message, incoming));
  if (index === -1) {
    const at = isPending(incoming) ? list.length : insertionIndex(list, incoming.id);
    return [...list.slice(0, at), incoming, ...list.slice(at)];
  }
  const existing = list[index];
  const merged = { ...incoming, status: strongerStatus(existing.status, incoming.status) };
  if (isPending(existing) && !isPending(incoming)) {
    // The optimistic copy sat at the end; move the stored one to its id slot.
    const rest = [...list.slice(0, index), ...list.slice(index + 1)];
    const at = insertionIndex(rest, merged.id);
    return [...rest.slice(0, at), merged, ...rest.slice(at)];
  }
  return list.map((message, i) => (i === index ? merged : message));
}

/** Merges a page from GET /messages, which arrives newest-first. */
export function mergePage(list: Message[], newestFirst: Message[]): Message[] {
  return [...newestFirst].reverse().reduce<Message[]>(upsertMessage, [...list]);
}

/** Applies message.updated (reactions, delete, expiry) and refreshes replies that quote it. */
export function applyMessageUpdate(list: Message[], updated: Message): Message[] {
  if (!list.some((message) => message.id === updated.id)) return list;
  return upsertMessage(list, updated).map((message) =>
    message.reply_to?.id === updated.id
      ? { ...message, reply_to: { ...message.reply_to, body: updated.body, deleted: updated.deleted } }
      : message,
  );
}

export function applyReceipt(list: Message[], messageIds: Id[], status: ServerMessageStatus): Message[] {
  const ids = new Set(messageIds);
  return list.map((message) =>
    ids.has(message.id) ? { ...message, status: strongerStatus(message.status, status) } : message,
  );
}

export function setPendingStatus(list: Message[], clientId: string, status: "sending" | "failed"): Message[] {
  return list.map((message) =>
    message.client_id === clientId && isPending(message) ? { ...message, status } : message,
  );
}

interface OptimisticDraft {
  localId: Id;
  conversationId: Id;
  senderId: Id;
  clientId: string;
  body: string;
  replyTo: Message | null;
  now: IsoTime;
}

export function createOptimisticMessage(draft: OptimisticDraft): PendingMessage {
  const { replyTo } = draft;
  return {
    id: draft.localId,
    conversation_id: draft.conversationId,
    client_id: draft.clientId,
    sender_id: draft.senderId,
    kind: "text",
    body: draft.body,
    system_event: null,
    reply_to: replyTo
      ? { id: replyTo.id, sender_id: replyTo.sender_id, body: replyTo.body, deleted: replyTo.deleted }
      : null,
    created_at: draft.now,
    expires_at: null,
    deleted: false,
    status: "sending",
    reactions: [],
  };
}

/** Cursor for the next older page. */
export function oldestStoredId(list: Message[]): Id | undefined {
  return list.find((message) => !isPending(message))?.id;
}

/** The newest text message someone else sent: what POST /read should point at. */
export function latestIncomingId(list: Message[], meId: Id): Id | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    const message = list[i];
    if (!isPending(message) && message.kind === "text" && message.sender_id !== meId) return message.id;
  }
  return undefined;
}
