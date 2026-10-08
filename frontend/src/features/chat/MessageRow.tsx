"use client";

import { memo, useRef, type TouchEvent } from "react";
import { MessageActions, MessageBubble } from "@/components/ui";
import { formatBubbleTime } from "@/lib/format";
import type { BubbleItem } from "@/lib/timeline";
import type { Id, UserPublic } from "@/lib/types";
import { myReaction, senderColor, summarizeReactions } from "./chatLogic";
import styles from "./MessageRow.module.css";
import { messageMenu, type MessageHandlers } from "./messageMenu";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

interface MessageRowProps {
  item: BubbleItem;
  meId: Id | undefined;
  isGroup: boolean;
  nameOf: (userId: Id) => string;
  userOf: (userId: Id) => UserPublic | undefined;
  handlers: MessageHandlers;
  highlighted: boolean;
}

/** One bubble with its quote, reactions, hover toolbar and long-press menu. */
export const MessageRow = memo(function MessageRow({
  item,
  meId,
  isGroup,
  nameOf,
  userOf,
  handlers,
  highlighted,
}: MessageRowProps) {
  const { message, direction, position } = item;
  const outgoing = direction === "outgoing";
  const stored = message.id > 0;
  const failed = message.status === "failed";
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const startPress = (event: TouchEvent) => {
    const touch = event.touches[0];
    const at = { x: touch.clientX, y: touch.clientY };
    cancelPress();
    press.current = { ...at, timer: setTimeout(() => handlers.openMenu(message, at), LONG_PRESS_MS) };
  };
  const movePress = (event: TouchEvent) => {
    const touch = event.touches[0];
    const start = press.current;
    if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MOVE_TOLERANCE_PX) cancelPress();
  };

  const quote = message.reply_to
    ? {
        author: message.reply_to.sender_id === meId ? "You" : nameOf(message.reply_to.sender_id ?? 0),
        text: message.reply_to.deleted ? "This message was deleted." : message.reply_to.body,
        color: isGroup ? senderColor(message.reply_to.sender_id) : undefined,
      }
    : undefined;
  const sender = !outgoing && isGroup && message.sender_id !== null ? message.sender_id : null;
  const senderUser = sender === null ? undefined : userOf(sender);

  return (
    <div
      id={`m-${message.id}`}
      className={styles.row}
      onTouchStart={stored && !message.deleted ? startPress : undefined}
      onTouchMove={movePress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
    >
      <MessageBubble
        direction={direction}
        position={position}
        time={formatBubbleTime(message.created_at)}
        status={message.status === "failed" || message.status === null ? "sending" : message.status}
        expires={message.expires_at !== null}
        deleted={message.deleted}
        sender={sender === null ? undefined : nameOf(sender)}
        senderColor={senderColor(sender)}
        senderAvatar={senderUser?.avatar_url ?? undefined}
        quote={quote}
        onQuoteClick={message.reply_to ? () => handlers.jumpTo(message.reply_to!.id) : undefined}
        reactions={summarizeReactions(message.reactions, meId)}
        onReactionsClick={() => handlers.showReactions(message)}
        highlighted={highlighted}
        onContextMenu={
          stored && !message.deleted
            ? (event) => {
                event.preventDefault();
                handlers.openMenu(message, { x: event.clientX, y: event.clientY });
              }
            : undefined
        }
        actions={
          stored ? (
            <MessageActions
              direction={direction}
              selectedReaction={myReaction(message.reactions, meId)}
              onReact={(emoji) => handlers.react(message, emoji)}
              onReply={() => handlers.reply(message)}
              menuItems={messageMenu(message, handlers, meId)}
            />
          ) : undefined
        }
      >
        {message.body}
      </MessageBubble>
      {failed ? (
        <div className={styles.failed} role="alert">
          <span>Not sent.</span>
          <button type="button" className={styles.retry} onClick={() => handlers.retry(message)}>
            Tap to retry
          </button>
        </div>
      ) : null}
    </div>
  );
});
