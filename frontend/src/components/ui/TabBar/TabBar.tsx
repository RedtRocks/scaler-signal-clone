import clsx from "clsx";
import { Icon, type IconName } from "../Icon/Icon";
import { UnreadBadge } from "../UnreadBadge/UnreadBadge";
import styles from "./TabBar.module.css";

export type TabBarTab = [id: string, icon: IconName, label: string];

export interface TabBarProps {
  active?: string;
  badges?: Record<string, number>;
  tabs?: TabBarTab[];
  onSelect?: (id: string) => void;
}

const DEFAULT_TABS: TabBarTab[] = [
  ["chats", "tab-chats", "Chats"],
  ["stories", "tab-stories", "Stories"],
];

export function TabBar({ active = "chats", badges, tabs = DEFAULT_TABS, onSelect }: TabBarProps) {
  return (
    <nav className={styles.tabbar} aria-label="Tabs">
      {tabs.map(([id, icon, label]) => {
        const isActive = active === id;
        const badge = badges?.[id];
        return (
          <button
            key={id}
            type="button"
            className={clsx(styles.tab, isActive && styles.active)}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect?.(id)}
          >
            <span className={styles.icon}>
              <Icon name={icon} size={28} />
              {badge ? (
                <span className={styles.badge}>
                  <UnreadBadge count={badge} tone="alert" />
                </span>
              ) : null}
            </span>
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
