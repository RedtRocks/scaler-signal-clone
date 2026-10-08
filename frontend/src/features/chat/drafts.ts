import type { Id } from "@/lib/types";

/** Unsent composer text per Conversation, kept while the person navigates elsewhere. */
const drafts = new Map<Id, string>();

export function getDraft(conversationId: Id): string {
  return drafts.get(conversationId) ?? "";
}

export function setDraft(conversationId: Id, text: string): void {
  if (text) drafts.set(conversationId, text);
  else drafts.delete(conversationId);
}
