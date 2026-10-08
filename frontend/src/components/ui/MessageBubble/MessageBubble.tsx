import clsx from "clsx";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Avatar } from "../Avatar/Avatar";
import { DeliveryStatus, type MessageStatus } from "../DeliveryStatus/DeliveryStatus";
import { Icon } from "../Icon/Icon";
import { QuoteBlock } from "../QuoteBlock/QuoteBlock";
import { ReactionChips, type ReactionSummary } from "../ReactionChips/ReactionChips";
import styles from "./MessageBubble.module.css";

export type SenderColor = "green" | "indigo" | "crimson" | "teal" | "orange";
export type BubblePosition = "single" | "first" | "middle" | "last";

export interface MessageBubbleProps {
  direction: "incoming" | "outgoing";
  time: string;
  status?: MessageStatus;
  /** Place in a run of consecutive messages from one sender. */
  position?: BubblePosition;
  /** Disappearing-timer glyph next to the time. */
  expires?: boolean;
  /** Group incoming: sender name (first bubble) and avatar (last bubble). */
  sender?: string;
  senderColor?: SenderColor;
  senderAvatar?: string;
  quote?: { author: string; text: string; color?: SenderColor };
  onQuoteClick?: () => void;
  /** Single emoji (index.d.ts). Prefer `reactions` for counts. */
  reaction?: string;
  reactions?: ReactionSummary[];
  onReactionsClick?: (emoji: string) => void;
  chatColor?: string;
  /** Renders "This message was deleted." */
  deleted?: boolean;
  /** Desktop hover toolbar (MessageActions), placed beside the bubble. */
  actions?: ReactNode;
  /** Briefly flash (jumped to from a quote). */
  highlighted?: boolean;
  id?: string;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}

export function MessageBubble({
  direction,
  time,
  status = "sent",
  position = "single",
  expires,
  sender,
  senderColor = "indigo",
  senderAvatar,
  quote,
  onQuoteClick,
  reaction,
  reactions,
  onReactionsClick,
  chatColor,
  deleted,
  actions,
  highlighted,
  id,
  onContextMenu,
  children,
}: MessageBubbleProps) {
  const out = direction === "outgoing";
  const style = out && chatColor ? ({ "--bubble-outgoing": chatColor } as CSSProperties) : undefined;
  const summary = reactions ?? (reaction ? [{ emoji: reaction, count: 1 }] : undefined);
  const hasReactions = !!summary?.some((r) => r.count > 0);
  const showAvatar = !out && sender && (position === "single" || position === "last");
  const showName = !out && sender && (position === "single" || position === "first");

  return (
    <div
      id={id}
      className={clsx(
        styles.msg,
        out ? styles.out : styles.in,
        styles[position],
        hasReactions && styles.withReactions,
        highlighted && styles.highlighted,
      )}
      style={style}
    >
      {!out && sender ? (
        showAvatar ? (
          <Avatar name={sender} src={senderAvatar} size={28} className={styles.avatar} />
        ) : (
          <span className={styles.avspace} />
        )
      ) : null}
      <div className={styles.stack}>
        <div className={clsx(styles.bubble, deleted && styles.deleted)} onContextMenu={onContextMenu}>
          {showName ? (
            <div className={styles.sender} style={{ color: `var(--sender-${senderColor})` }}>
              {sender}
            </div>
          ) : null}
          {quote && !deleted ? (
            <QuoteBlock
              variant="bubble"
              author={quote.author}
              text={quote.text}
              color={out ? undefined : quote.color}
              onOutgoing={out}
              onClick={onQuoteClick}
            />
          ) : null}
          <span className={styles.text}>{deleted ? "This message was deleted." : children}</span>
          <span className={styles.meta}>
            {time}
            {expires ? <Icon name="timer" size={13} strokeWidth={1.8} label="Disappearing" /> : null}
            {out && !deleted ? <DeliveryStatus status={status} /> : null}
          </span>
        </div>
        {hasReactions && summary ? (
          <ReactionChips reactions={summary} onClick={onReactionsClick} className={styles.reactions} />
        ) : null}
      </div>
      {actions && !deleted ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
