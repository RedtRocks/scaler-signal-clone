import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { DropdownMenu, type MenuEntry } from "../Menu/Menu";
import styles from "./ChatListHeader.module.css";

export interface ChatListHeaderProps {
  title?: string;
  onCompose?: () => void;
  /** Desktop ⋯ menu (e.g. New group, Mark all read, Settings). */
  menuItems?: MenuEntry[];
  /** Phone: left avatar (opens settings/profile)  */
  selfName?: string;
  selfAvatar?: string;
  onProfile?: () => void;
}

/**
 * Desktop: "Chats" · ✎ · ⋯.  Phone (<600px or .sg-mobile): avatar · "Chats" centred; camera and compose float (see Sidebar).
 * Both are rendered; CSS picks one so it follows the viewport without JS.
 */
export function ChatListHeader({
  title = "Chats",
  onCompose,
  menuItems,
  selfName = "Me",
  selfAvatar,
  onProfile,
}: ChatListHeaderProps) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.self} aria-label="Profile and settings" onClick={onProfile}>
        <Avatar name={selfName} src={selfAvatar} size={28} />
      </button>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.actions}>
        <span className={styles.composeSlot}>
          <Button variant="icon" icon="compose" iconSize={22} aria-label="New chat" onClick={onCompose} />
        </span>
        {menuItems?.length ? (
          <span className={styles.desktopOnly}>
            <DropdownMenu items={menuItems} label="More options" />
          </span>
        ) : null}
      </div>
    </header>
  );
}
