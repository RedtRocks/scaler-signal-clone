import clsx from "clsx";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { DropdownMenu, type MenuEntry } from "../Menu/Menu";
import styles from "./ChatHeader.module.css";

export interface ChatHeaderProps {
  name: string;
  /** Presence ("online", "last seen 2h ago"), member count or timer text. */
  subtitle?: string;
  timer?: boolean;
  verified?: boolean;
  isGroup?: boolean;
  /** Phone layout: video + phone only. */
  compact?: boolean;
  avatarSrc?: string;
  avatarSize?: number;
  kind?: "note" | "group";
  online?: boolean;
  onBack?: () => void;
  /** Extras beyond index.d.ts */
  onTitleClick?: () => void;
  onVideoCall?: () => void;
  onVoiceCall?: () => void;
  onSearch?: () => void;
  /** ⋯ menu entries; when omitted the ⋯ button calls onMore. */
  moreItems?: MenuEntry[];
  onMore?: () => void;
}

export function ChatHeader({
  name,
  subtitle,
  timer,
  verified,
  isGroup,
  compact,
  avatarSrc,
  avatarSize = 32,
  kind,
  online,
  onBack,
  onTitleClick,
  onVideoCall,
  onVoiceCall,
  onSearch,
  moreItems,
  onMore,
}: ChatHeaderProps) {
  const title = (
    <>
      <Avatar name={name} src={avatarSrc} kind={kind} size={avatarSize} online={online} />
      <span className={styles.text}>
        <span className={styles.name}>
          <span className={styles.nameText}>{name}</span>
          {verified ? <Icon name="verified" size={16} className={styles.verified} label="Verified" /> : null}
        </span>
        {subtitle ? (
          <span className={styles.sub}>
            {timer ? <Icon name="timer" size={12} /> : null}
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <header className={styles.header}>
      {onBack ? <Button variant="icon" icon="back" iconSize={22} aria-label="Back" onClick={onBack} /> : null}
      {onTitleClick ? (
        <button type="button" className={clsx(styles.title, styles.titleBtn)} onClick={onTitleClick}>
          {title}
        </button>
      ) : (
        <div className={styles.title}>{title}</div>
      )}
      <div className={styles.actions}>
        <Button variant="icon" icon="video-header" aria-label="Video call" onClick={onVideoCall} />
        {isGroup ? null : <Button variant="icon" icon="phone" aria-label="Voice call" onClick={onVoiceCall} />}
        {compact ? null : <Button variant="icon" icon="search" iconSize={20} aria-label="Search in chat" onClick={onSearch} />}
        {compact ? null : moreItems?.length ? (
          <DropdownMenu items={moreItems} label="More" />
        ) : (
          <Button variant="icon" icon="more" aria-label="More" onClick={onMore} />
        )}
      </div>
    </header>
  );
}
