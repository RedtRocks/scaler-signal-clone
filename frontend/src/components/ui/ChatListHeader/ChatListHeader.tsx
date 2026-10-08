import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { DropdownMenu, type MenuEntry } from "../Menu/Menu";
import styles from "./ChatListHeader.module.css";

export interface ChatListHeaderProps {
  title?: string;
  onCompose?: () => void;
  /** Desktop ⋯ menu (e.g. New group, Mark all read, Settings). */
  menuItems?: MenuEntry[];
  /** Phone: left avatar (opens settings/profile) and camera. */
  selfName?: string;
  selfAvatar?: string;
  onProfile?: () => void;
  onCamera?: () => void;
}

/**
 * Desktop: "Chats" · ✎ · ⋯.  Phone (<600px or .sg-mobile): avatar · "Chats" centred · camera · compose.
 * Both are rendered; CSS picks one so it follows the viewport without JS.
 */
export function ChatListHeader({
  title = "Chats",
  onCompose,
  menuItems,
  selfName = "Me",
  selfAvatar,
  onProfile,
  onCamera,
}: ChatListHeaderProps) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.self} aria-label="Profile and settings" onClick={onProfile}>
        <Avatar name={selfName} src={selfAvatar} size={28} />
      </button>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        <span className={styles.phoneOnly}>
          <Button variant="icon" icon="camera" iconSize={24} aria-label="Camera" onClick={onCamera} />
        </span>
        <Button variant="icon" icon="compose" iconSize={22} aria-label="New chat" onClick={onCompose} />
        {menuItems?.length ? (
          <span className={styles.desktopOnly}>
            <DropdownMenu items={menuItems} label="More options" />
          </span>
        ) : null}
      </div>
    </header>
  );
}
