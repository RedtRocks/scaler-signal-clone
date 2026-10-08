import type { IconName } from "../Icon/Icon";
import { Icon } from "../Icon/Icon";
import styles from "./QuickActions.module.css";

export type QuickAction = [icon: IconName, label: string];

export interface QuickActionsProps {
  items?: QuickAction[];
  onAction?: (label: string) => void;
}

const DEFAULT_ITEMS: QuickAction[] = [
  ["video", "video"],
  ["phone", "audio"],
  ["muted", "muted"],
  ["search-action", "search"],
];

export function QuickActions({ items = DEFAULT_ITEMS, onAction }: QuickActionsProps) {
  return (
    <div className={styles.quick} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(([icon, label]) => (
        <button key={label} type="button" className={styles.btn} onClick={() => onAction?.(label)}>
          <Icon name={icon} size={24} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
