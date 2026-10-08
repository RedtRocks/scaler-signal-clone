import clsx from "clsx";
import type { CSSProperties } from "react";
import { Icon } from "../Icon/Icon";
import type { SenderColor } from "../MessageBubble/MessageBubble";
import styles from "./QuoteBlock.module.css";

export interface QuoteBlockProps {
  /** "You" for your own messages. */
  author: string;
  text: string;
  /** Stripe/author colour for group senders. */
  color?: SenderColor;
  /** composer: the "Replying to" bar above the input. bubble: inside a message. */
  variant?: "composer" | "bubble";
  /** Inside an outgoing bubble (light-on-blue styling). */
  onOutgoing?: boolean;
  onClick?: () => void;
  /** Shows the ✕ button (composer). */
  onClose?: () => void;
}

export function QuoteBlock({ author, text, color, variant = "composer", onOutgoing, onClick, onClose }: QuoteBlockProps) {
  const tint = color ? ({ "--quote-ink": `var(--sender-${color})` } as CSSProperties) : undefined;
  const body = (
    <>
      <span className={styles.author}>{author}</span>
      <span className={styles.text}>{text}</span>
    </>
  );
  return (
    <div
      className={clsx(styles.quote, styles[variant], onOutgoing && styles.outgoing)}
      style={tint}
      aria-label={variant === "composer" ? `Replying to ${author}` : undefined}
    >
      {onClick ? (
        <button type="button" className={styles.body} onClick={onClick}>
          {body}
        </button>
      ) : (
        <span className={styles.body}>{body}</span>
      )}
      {onClose ? (
        <button type="button" className={styles.close} aria-label="Cancel reply" onClick={onClose}>
          <Icon name="close" size={16} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}
