import clsx from "clsx";
import styles from "./UnreadBadge.module.css";

export interface UnreadBadgeProps {
  count?: number;
  tone?: "unread" | "alert";
  dot?: boolean;
  className?: string;
}

export function UnreadBadge({ count, tone = "unread", dot, className }: UnreadBadgeProps) {
  if (dot) return <span className={clsx(styles.dot, className)} aria-label="unread" />;
  if (!count) return null;
  return (
    <span
      className={clsx(styles.badge, tone === "alert" && styles.alert, className)}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
