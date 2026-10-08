import { systemEventText } from "@/lib/format";
import type { ConversationSummary, Id, Message } from "@/lib/types";

export type PreviewStatus = "sending" | "sent" | "delivered" | "read";

export interface RowPreview {
  text: string;
  /** Group previews: who said it ("You", "Kai"). */
  sender?: string;
  /** My own last Message's status; the row shows it when nothing is unread. */
  status?: PreviewStatus;
}

/** What a Conversation row shows for its last Message. `nameOf` returns "" when a name is unknown. */
export function rowPreview(
  conversation: Pick<ConversationSummary, "kind">,
  last: Message | null,
  meId: Id,
  nameOf: (userId: Id) => string,
): RowPreview {
  if (!last) return { text: "" };
  if (last.kind === "system") {
    const event = last.system_event;
    return { text: event ? systemEventText(event, last.sender_id, meId, (id) => nameOf(id) || "Someone") : "" };
  }
  const mine = last.sender_id === meId;
  const status = mine && last.status && last.status !== "failed" ? last.status : undefined;
  const text = last.deleted ? (mine ? "You deleted this message" : "This message was deleted") : last.body;
  let sender: string | undefined;
  if (conversation.kind === "group" && !last.deleted) {
    sender = mine ? "You" : last.sender_id === null ? undefined : nameOf(last.sender_id) || undefined;
  }
  return { text, sender, status };
}
