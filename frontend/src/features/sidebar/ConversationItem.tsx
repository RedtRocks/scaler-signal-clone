"use client";
import { avatarKind } from "@/lib/conversationKind";

import { useRef, type MouseEvent, type TouchEvent } from "react";
import { ContextMenu, ConversationRow, useContextMenu, type MenuEntry } from "@/components/ui";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { formatListTime } from "@/lib/format";
import type { ConversationSummary, Id } from "@/lib/types";
import { useConversationStore, usePresenceStore, useToastStore } from "@/store";
import { rowPreview } from "./preview";

const LONG_PRESS_MS = 500;

/** One Conversation row with its pin / mute / read / archive context menu. */
export function ConversationItem({
  conversation,
  meId,
  nameOf,
  selected,
  onOpen,
}: {
  conversation: ConversationSummary;
  meId: Id;
  nameOf: (userId: Id) => string;
  selected: boolean;
  onOpen: (id: Id) => void;
}) {
  const typing = usePresenceStore((s) => (s.typing[conversation.id]?.length ?? 0) > 0);
  const updateSettings = useConversationStore((s) => s.updateSettings);
  const clearUnread = useConversationStore((s) => s.clearUnread);
  const push = useToastStore((s) => s.push);
  const menu = useContextMenu();
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  const { last_message: last, id } = conversation;
  const preview = rowPreview(conversation, last, meId, nameOf);

  const change = async (patch: { pinned?: boolean; muted?: boolean; archived?: boolean }, done: string) => {
    try {
      await updateSettings(id, patch);
      push(done);
    } catch {
      push("Couldn't update this chat.");
    }
  };

  const markRead = async () => {
    if (!last || last.id < 1) return;
    clearUnread(id);
    try {
      await api.markRead(id, last.id);
    } catch {
      push("Couldn't mark as read.");
    }
  };

  const items: MenuEntry[] = [
    conversation.pinned
      ? { label: "Unpin chat", onSelect: () => void change({ pinned: false }, "Chat unpinned.") }
      : { label: "Pin chat", onSelect: () => void change({ pinned: true }, "Chat pinned.") },
    conversation.muted
      ? { label: "Unmute notifications", icon: "muted", onSelect: () => void change({ muted: false }, "Notifications on.") }
      : { label: "Mute notifications", icon: "muted", onSelect: () => void change({ muted: true }, "Chat muted.") },
    ...(conversation.unread_count > 0 ? [{ label: "Mark as read", icon: "check" as const, onSelect: () => void markRead() }] : []),
    "separator",
    conversation.archived
      ? { label: "Unarchive", onSelect: () => void change({ archived: false }, "Chat unarchived.") }
      : { label: "Archive", onSelect: () => void change({ archived: true }, "Chat archived.") },
  ];

  const startPress = (e: TouchEvent) => {
    const touch = e.touches[0];
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      menu.onContextMenu({ preventDefault: () => {}, clientX: touch.clientX, clientY: touch.clientY });
    }, LONG_PRESS_MS);
  };
  const endPress = () => clearTimeout(pressTimer.current);

  return (
    <li onTouchStart={startPress} onTouchEnd={endPress} onTouchMove={endPress} onTouchCancel={endPress}>
      <ConversationRow
        name={conversation.title}
        avatarSrc={mediaUrl(conversation.avatar_url ?? conversation.peer?.avatar_url ?? null) ?? undefined}
        kind={avatarKind(conversation)}
        time={conversation.last_message_at ? formatListTime(conversation.last_message_at) : ""}
        preview={preview.text}
        sender={preview.sender}
        unread={conversation.unread_count}
        status={preview.status}
        muted={conversation.muted}
        typing={typing}
        selected={selected}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onOpen(id);
        }}
        onContextMenu={(e: MouseEvent<HTMLButtonElement>) => menu.onContextMenu(e)}
      />
      <ContextMenu position={menu.position} items={items} onClose={menu.close} label={`${conversation.title} options`} />
    </li>
  );
}
