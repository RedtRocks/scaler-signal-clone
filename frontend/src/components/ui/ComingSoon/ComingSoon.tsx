import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import styles from "./ComingSoon.module.css";

export interface ComingSoonProps {
  icon?: IconName;
  title?: string;
  children?: ReactNode;
}

export function ComingSoon({ icon = "phone", title = "Coming soon", children }: ComingSoonProps) {
  return (
    <div className={styles.soon}>
      <span className={styles.icon}>
        <Icon name={icon} size={32} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{children ?? "This feature isn’t available in this build yet."}</p>
    </div>
  );
}
