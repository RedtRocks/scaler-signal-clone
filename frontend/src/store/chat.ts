// What the conversation screen does: open, send, and signal typing.
import type { Id, Message } from "@/lib/types";
import { useConversationStore } from "./conversations";
import { useMessageStore } from "./messages";
import { scheduleMarkRead } from "./readTracker";
import { socket } from "./session";

const TYPING_THROTTLE_MS = 3_000;

/** Conversation id → when we last told the server we are typing there. */
const typingSentAt = new Map<Id, number>();

/** Call on each keystroke in the composer; sends at most one signal per 3 s. */
export function notifyTyping(conversationId: Id): void {
  const now = Date.now();
  if (now - (typingSentAt.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) return;
  typingSentAt.set(conversationId, now);
  socket.send({ type: "typing", data: { conversation_id: conversationId, is_typing: true } });
}

/** Call on send and on composer blur. Only signals if we said we were typing. */
export function stopTyping(conversationId: Id): void {
  if (!typingSentAt.delete(conversationId)) return;
  socket.send({ type: "typing", data: { conversation_id: conversationId, is_typing: false } });
}

/** Selects a conversation, loads its latest page and detail if needed, then marks it read. */
export async function openConversation(id: Id): Promise<void> {
  const { selectedId, select, loadDetail } = useConversationStore.getState();
  if (selectedId !== null && selectedId !== id) stopTyping(selectedId);
  select(id);
  const { threads, loadLatest } = useMessageStore.getState();
  await Promise.all([threads[id]?.loaded ? null : loadLatest(id), loadDetail(id)]);
  scheduleMarkRead();
}

export function closeConversation(): void {
  const { selectedId, select } = useConversationStore.getState();
  if (selectedId !== null) stopTyping(selectedId);
  select(null);
}

export function sendMessage(conversationId: Id, body: string, replyTo: Message | null = null): Promise<void> {
  stopTyping(conversationId);
  return useMessageStore.getState().send(conversationId, body, replyTo);
}
