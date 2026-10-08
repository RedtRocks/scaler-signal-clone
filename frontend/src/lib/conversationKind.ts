import type { ConversationSummary } from "./types";

/** Note to Self is the direct conversation whose only member is me. */
export function isNoteToSelf(conversation: Pick<ConversationSummary, "kind" | "member_count">): boolean {
  return conversation.kind === "direct" && conversation.member_count === 1;
}

/** The avatar style for a conversation: group glyph, Note to Self glyph, or initials/photo. */
export function avatarKind(conversation: Pick<ConversationSummary, "kind" | "member_count">): "group" | "note" | undefined {
  if (conversation.kind === "group") return "group";
  return isNoteToSelf(conversation) ? "note" : undefined;
}
