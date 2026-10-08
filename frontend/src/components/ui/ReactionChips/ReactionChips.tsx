import clsx from "clsx";
import styles from "./ReactionChips.module.css";

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** You reacted with this emoji. */
  mine?: boolean;
}

export interface ReactionChipsProps {
  reactions: ReactionSummary[];
  onClick?: (emoji: string) => void;
  className?: string;
}

/** Summary pill hung off the bottom edge of a bubble: up to 3 emoji (most used first) and a total. */
export function ReactionChips({ reactions, onClick, className }: ReactionChipsProps) {
  const list = reactions.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  if (!list.length) return null;
  const total = list.reduce((n, r) => n + r.count, 0);
  const label = list.map((r) => `${r.emoji} ${r.count}`).join(", ");
  return (
    <button
      type="button"
      className={clsx(styles.chips, list.some((r) => r.mine) && styles.mine, className)}
      aria-label={`Reactions: ${label}`}
      onClick={() => onClick?.(list[0].emoji)}
    >
      {list.slice(0, 3).map((r) => (
        <span key={r.emoji} className={styles.emoji} aria-hidden>
          {r.emoji}
        </span>
      ))}
      {total > 1 ? <span className={styles.count}>{total}</span> : null}
    </button>
  );
}
