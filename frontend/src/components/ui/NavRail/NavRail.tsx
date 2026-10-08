import clsx from "clsx";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { Icon, type IconName } from "../Icon/Icon";
import { UnreadBadge } from "../UnreadBadge/UnreadBadge";
import styles from "./NavRail.module.css";

export type NavRailId = "chats" | "calls" | "stories";

export interface NavRailProps {
  active?: NavRailId;
  badges?: Partial<Record<NavRailId, number>>;
  selfName?: string;
  selfAvatar?: string;
  onSelect?: (id: NavRailId) => void;
  /** Extras beyond index.d.ts: the rail's other buttons. */
  onMenu?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
  settingsActive?: boolean;
}

const ITEMS: [NavRailId, IconName, string][] = [
  ["chats", "chat", "Chats"],
  ["calls", "phone", "Calls"],
  ["stories", "stories", "Stories"],
];

export function NavRail({
  active = "chats",
  badges,
  selfName = "Me",
  selfAvatar,
  onSelect,
  onMenu,
  onSettings,
  onProfile,
  settingsActive,
}: NavRailProps) {
  return (
    <nav className={styles.rail} aria-label="Main">
      <Button variant="icon" icon="menu" aria-label="Menu" onClick={onMenu} />
      <div className={styles.items}>
        {ITEMS.map(([id, icon, label]) => {
          const isActive = !settingsActive && active === id;
          const badge = badges?.[id];
          return (
            <button
              key={id}
              type="button"
              className={clsx(styles.item, isActive && styles.active)}
              aria-label={label}
              title={label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect?.(id)}
            >
              <Icon name={icon} size={id === "chats" ? 26 : 24} />
              {badge ? (
                <span className={styles.badge}>
                  <UnreadBadge count={badge} tone="alert" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={clsx(styles.item, settingsActive && styles.active)}
          aria-label="Settings"
          title="Settings"
          aria-current={settingsActive ? "page" : undefined}
          onClick={onSettings}
        >
          <Icon name="settings" />
        </button>
        <button type="button" className={styles.self} aria-label="Profile" onClick={onProfile}>
          <Avatar name={selfName} src={selfAvatar} size={32} />
        </button>
      </div>
    </nav>
  );
}
