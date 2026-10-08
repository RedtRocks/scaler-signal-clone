import clsx from "clsx";
import { Icon } from "../Icon/Icon";
import { UnreadBadge } from "../UnreadBadge/UnreadBadge";
import styles from "./ScrollToBottom.module.css";

export interface ScrollToBottomProps {
  /** New messages below the fold. */
  count?: number;
  visible?: boolean;
  onClick: () => void;
  className?: string;
}

/** Floating ↓ button at the bottom-right of the timeline. Position the parent `relative`. */
export function ScrollToBottom({ count, visible = true, onClick, className }: ScrollToBottomProps) {
  return (
    <button
      type="button"
      className={clsx(styles.button, !visible && styles.hidden, className)}
      aria-label={count ? `Scroll to bottom, ${count} new` : "Scroll to bottom"}
      tabIndex={visible ? 0 : -1}
      onClick={onClick}
    >
      <Icon name="arrow-down" size={20} strokeWidth={1.8} />
      {count ? (
        <span className={styles.badge}>
          <UnreadBadge count={count} />
        </span>
      ) : null}
    </button>
  );
}
