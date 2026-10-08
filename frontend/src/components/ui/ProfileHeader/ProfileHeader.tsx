import type { ReactNode } from "react";
import { Avatar } from "../Avatar/Avatar";
import styles from "./ProfileHeader.module.css";

export interface ProfileHeaderProps {
  name: string;
  subtitle?: string;
  avatarSrc?: string;
  kind?: "note" | "group";
  size?: number;
  /** Extra line(s) under the subtitle, e.g. an about text or an "Edit" link. */
  children?: ReactNode;
}

export function ProfileHeader({ name, subtitle, avatarSrc, kind, size = 96, children }: ProfileHeaderProps) {
  return (
    <div className={styles.profile}>
      <Avatar name={name} src={avatarSrc} kind={kind} size={size} />
      <h2 className={styles.name}>{name}</h2>
      {subtitle ? <div className={styles.sub}>{subtitle}</div> : null}
      {children}
    </div>
  );
}
