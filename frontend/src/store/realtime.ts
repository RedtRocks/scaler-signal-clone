// Routes socket pushes into the stores, and sends the acks the protocol expects.
import type { SignalSocket } from "@/lib/socket";
import type { ConversationSummary, Id, Message } from "@/lib/types";
import { useAuthStore } from "./auth";
import { useConversationStore } from "./conversations";
import { useMessageStore } from "./messages";
import { usePresenceStore } from "./presence";
import { cancelMarkRead, scheduleMarkRead } from "./readTracker";

const DELIVERED_BATCH_MS = 200;

/** Collects message ids and sends one `delivered` frame per 200 ms burst. */
function createDeliveredAcker(socket: SignalSocket) {
  let pending: Id[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    socket.send({ type: "delivered", data: { message_ids: pending } });
    pending = [];
    timer = undefined;
  };

  return {
    ack(messageId: Id) {
      pending.push(messageId);
      timer ??= setTimeout(flush, DELIVERED_BATCH_MS);
    },
    cancel() {
      clearTimeout(timer);
      pending = [];
      timer = undefined;
    },
  };
}

function handleNewMessage(message: Message, ackDelivered: (id: Id) => void): void {
  useMessageStore.getState().receive(message);
  const { sender_id: senderId, conversation_id: conversationId } = message;
  if (senderId === null || senderId === useAuthStore.getState().me?.id) return; // My other tab's echo.

  usePresenceStore.getState().setTyping(conversationId, senderId, false);
  if (message.kind === "text") ackDelivered(message.id);
  if (conversationId === useConversationStore.getState().selectedId) scheduleMarkRead();
}

function handleConversationUpdated(summary: ConversationSummary): void {
  const conversations = useConversationStore.getState();
  conversations.upsert(summary);
  // Members may have changed; refresh the detail if a screen is using it.
  if (conversations.details[summary.id]) conversations.loadDetail(summary.id).catch(() => {});
}

/** After a reconnect, fetch what the socket missed while it was down. */
function resync(): void {
  useConversationStore.getState().loadAll().catch(() => {});
  const { threads, loadLatest } = useMessageStore.getState();
  for (const [id, thread] of Object.entries(threads)) {
    if (thread.loaded) loadLatest(Number(id)).catch(() => {});
  }
}

/** Focus and visibility changes can make the open conversation readable. */
function listenForAttention(): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("focus", scheduleMarkRead);
  document.addEventListener("visibilitychange", scheduleMarkRead);
  return () => {
    window.removeEventListener("focus", scheduleMarkRead);
    document.removeEventListener("visibilitychange", scheduleMarkRead);
    cancelMarkRead();
  };
}

/** Subscribes every server event to its store action. Returns the undo. */
export function wireRealtime(socket: SignalSocket): () => void {
  const delivered = createDeliveredAcker(socket);
  let connectedBefore = false;
  const conversations = () => useConversationStore.getState();
  const messages = () => useMessageStore.getState();
  const presence = () => usePresenceStore.getState();

  const unsubscribers = [
    socket.on("hello", () => {
      if (connectedBefore) resync();
      connectedBefore = true;
    }),
    socket.on("message.new", (message) => handleNewMessage(message, delivered.ack)),
    socket.on("message.updated", (message) => messages().applyUpdate(message)),
    socket.on("receipt", (receipt) => messages().applyReceipt(receipt)),
    socket.on("conversation.updated", handleConversationUpdated),
    socket.on("conversation.removed", ({ conversation_id }) => conversations().markLeft(conversation_id)),
    socket.on("read", ({ conversation_id }) => conversations().clearUnread(conversation_id)),
    socket.on("typing", ({ conversation_id, user_id, is_typing }) =>
      presence().setTyping(conversation_id, user_id, is_typing),
    ),
    socket.on("presence", (event) => presence().applyPresence(event)),
    listenForAttention(),
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    delivered.cancel();
  };
}
