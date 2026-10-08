import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./TypingIndicator.module.css";

export interface TypingIndicatorProps {
  /** Just the dots (conversation-row preview). */
  inline?: boolean;
  /** Group chats: 28px sender avatar shown left of the bubble. */
  avatar?: ReactNode;
  className?: string;
}

export function TypingIndicator({ inline, avatar, className }: TypingIndicatorProps) {
  const dots = (
    <span className={styles.dots} role="status" aria-label="typing">
      <i />
      <i />
      <i />
    </span>
  );
  if (inline) return dots;
  return (
    <div className={clsx(styles.row, className)}>
      {avatar}
      <div className={styles.bubble}>{dots}</div>
    </div>
  );
}
