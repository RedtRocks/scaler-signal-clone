import { api } from "@/lib/api";
import { useConversationStore } from "./conversations";
import { useMessageStore } from "./messages";

const READ_DEBOUNCE_MS = 300;

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** The user can actually see the open conversation. */
function isAttending(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
}

function markOpenConversationRead(): void {
  const conversationId = useConversationStore.getState().selectedId;
  if (conversationId === null || !isAttending()) return;
  const upTo = useMessageStore.getState().advanceReadPointer(conversationId);
  if (upTo === undefined) return;
  useConversationStore.getState().clearUnread(conversationId);
  // If the POST fails, move the pointer back so the next focus or new message tries again.
  api.markRead(conversationId, upTo).catch(() => useMessageStore.getState().rewindReadPointer(conversationId, upTo));
}

/**
 * Marks the open conversation read, if the window is visible and focused and a
 * newer incoming message exists. Call it on open, on new messages and on focus.
 */
export function scheduleMarkRead(): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(markOpenConversationRead, READ_DEBOUNCE_MS);
}

export function cancelMarkRead(): void {
  clearTimeout(debounceTimer);
}
