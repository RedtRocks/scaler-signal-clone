import clsx from "clsx";
import { Icon } from "../Icon/Icon";
import styles from "./ReactionPicker.module.css";

export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export interface ReactionPickerProps {
  /** Your current reaction (highlighted; picking it again removes it). */
  selected?: string;
  emojis?: readonly string[];
  onSelect: (emoji: string) => void;
  /** Shows a trailing "more" button (full emoji picker, not built). */
  onMore?: () => void;
}

export function ReactionPicker({ selected, emojis = DEFAULT_REACTIONS, onSelect, onMore }: ReactionPickerProps) {
  return (
    <div className={styles.picker} role="toolbar" aria-label="React">
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          className={clsx(styles.emoji, selected === e && styles.selected)}
          aria-label={`React with ${e}`}
          aria-pressed={selected === e}
          onClick={() => onSelect(e)}
        >
          <span aria-hidden>{e}</span>
        </button>
      ))}
      {onMore ? (
        <button type="button" className={clsx(styles.emoji, styles.more)} aria-label="More reactions" onClick={onMore}>
          <Icon name="more" size={20} />
        </button>
      ) : null}
    </div>
  );
}
