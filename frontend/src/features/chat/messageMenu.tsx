import type { MenuEntry } from "@/components/ui";
import type { Message } from "@/lib/types";
import { canDeleteForEveryone } from "./chatLogic";

/** What the row and the context menu can do to one message. */
export interface MessageHandlers {
  reply: (message: Message) => void;
  react: (message: Message, emoji: string) => void;
  copy: (message: Message) => void;
  deleteForEveryone: (message: Message) => void;
  retry: (message: Message) => void;
  showReactions: (message: Message) => void;
  jumpTo: (messageId: number) => void;
  openMenu: (message: Message, at: { x: number; y: number }) => void;
}

/** Reply, copy and delete: shared by the hover bar's ⋯ menu and the right-click / long-press menu. */
export function messageMenu(message: Message, handlers: MessageHandlers, meId: number | undefined): MenuEntry[] {
  const items: MenuEntry[] = [
    { label: "Reply", icon: "reply", onSelect: () => handlers.reply(message) },
    { label: "Copy text", icon: "copy", onSelect: () => handlers.copy(message) },
  ];
  if (canDeleteForEveryone(message, meId)) {
    items.push("separator", {
      label: "Delete for everyone",
      icon: "trash",
      destructive: true,
      onSelect: () => handlers.deleteForEveryone(message),
    });
  }
  return items;
}
