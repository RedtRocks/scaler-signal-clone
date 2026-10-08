import type { MenuEntry } from "@/components/ui";
import type { Message } from "@/lib/types";
import { canEdit } from "./chatLogic";

/** What the row and the context menu can do to one message. */
export interface MessageHandlers {
  reply: (message: Message) => void;
  react: (message: Message, emoji: string) => void;
  copy: (message: Message) => void;
  forward: (message: Message) => void;
  edit: (message: Message) => void;
  /** Opens the delete dialog (delete for me, and for everyone when allowed). */
  remove: (message: Message) => void;
  retry: (message: Message) => void;
  showReactions: (message: Message) => void;
  jumpTo: (messageId: number) => void;
  /** A short toast. */
  notify: (text: string) => void;
  openMenu: (message: Message, at: { x: number; y: number }) => void;
}

/** Reply, copy, forward, edit and delete: shared by the hover bar's ⋯ menu and the right-click / long-press menu. */
export function messageMenu(message: Message, handlers: MessageHandlers, meId: number | undefined): MenuEntry[] {
  const items: MenuEntry[] = [
    { label: "Reply", icon: "reply", onSelect: () => handlers.reply(message) },
  ];
  if (message.body) items.push({ label: "Copy text", icon: "copy", onSelect: () => handlers.copy(message) });
  if (message.body && !message.deleted && message.id > 0) {
    items.push({ label: "Forward", icon: "forward", onSelect: () => handlers.forward(message) });
  }
  if (canEdit(message, meId)) {
    items.push({ label: "Edit", icon: "edit", onSelect: () => handlers.edit(message) });
  }
  if (message.kind === "text" && message.id > 0) {
    items.push("separator", {
      label: "Delete",
      icon: "trash",
      destructive: true,
      onSelect: () => handlers.remove(message),
    });
  }
  return items;
}
