import clsx from "clsx";
import type { MouseEvent, ReactNode } from "react";
import { Avatar } from "../Avatar/Avatar";
import { DeliveryStatus, type MessageStatus } from "../DeliveryStatus/DeliveryStatus";
import { Icon } from "../Icon/Icon";
import { TypingIndicator } from "../TypingIndicator/TypingIndicator";
import { UnreadBadge } from "../UnreadBadge/UnreadBadge";
import styles from "./ConversationRow.module.css";

export interface ConversationRowProps {
  name: string;
  time: string;
  preview?: ReactNode;
  /** Group previews: prefix "Kai: ". */
  sender?: string;
  unread?: number;
  /** Your own last message's status (shown when there is no unread badge). */
  status?: MessageStatus;
  selected?: boolean;
  typing?: boolean;
  online?: boolean;
  /** Muted conversation: small muted glyph beside the time. */
  muted?: boolean;
  avatarSrc?: string;
  avatarSize?: number;
  kind?: "note" | "group";
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function ConversationRow({
  name,
  time,
  preview,
  sender,
  unread,
  status,
  selected,
  typing,
  online,
  muted,
  avatarSrc,
  avatarSize = 48,
  kind,
  onClick,
  onContextMenu,
}: ConversationRowProps) {
  return (
    <button
      type="button"
      className={clsx(styles.row, selected && styles.selected)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-current={selected ? "true" : undefined}
    >
      <Avatar name={name} src={avatarSrc} kind={kind} online={online} size={avatarSize} />
      <span className={styles.main}>
        <span className={styles.top}>
          <span className={styles.name}>{name}</span>
          <span className={styles.time}>
            {muted ? <Icon name="muted" size={14} label="Muted" /> : null}
            {time}
          </span>
        </span>
        <span className={styles.bottom}>
          <span className={clsx(styles.preview, unread ? styles.previewUnread : undefined)}>
            {typing ? (
              <TypingIndicator inline />
            ) : (
              <>
                {sender ? <span className={styles.sender}>{sender}: </span> : null}
                {preview}
              </>
            )}
          </span>
          {unread ? (
            <UnreadBadge count={unread} />
          ) : status ? (
            <span className={styles.status}>
              <DeliveryStatus status={status} />
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
