import type { ReactNode } from "react";
import { Avatar } from "../Avatar/Avatar";
import { Icon } from "../Icon/Icon";
import styles from "./EncryptionNotice.module.css";

export interface EncryptionNoticeProps {
  /** When given, renders the chat-start hero (avatar, name, subtitle) above the notice. */
  name?: string;
  subtitle?: string;
  avatarSrc?: string;
  kind?: "note" | "group";
  /** Override the notice copy. */
  children?: ReactNode;
}

/** Top of a conversation: who this is, and the (mocked) end-to-end encryption fact. */
export function EncryptionNotice({ name, subtitle, avatarSrc, kind, children }: EncryptionNoticeProps) {
  return (
    <div className={styles.wrap}>
      {name ? (
        <div className={styles.hero}>
          <Avatar name={name} src={avatarSrc} kind={kind} size={80} />
          <h2 className={styles.name}>{name}</h2>
          {subtitle ? <p className={styles.sub}>{subtitle}</p> : null}
        </div>
      ) : null}
      <p className={styles.notice}>
        <Icon name="lock" size={14} strokeWidth={1.8} />
        <span>
          {children ??
            "Messages and calls are end-to-end encrypted. No one outside of this chat, not even Signal, can read or listen to them."}
        </span>
      </p>
    </div>
  );
}
