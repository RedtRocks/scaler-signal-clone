import type { ReactNode } from "react";
import styles from "./SettingsGroup.module.css";

export interface SettingsGroupProps {
  title?: string;
  footer?: string;
  children: ReactNode;
}

/** Inset grouped list: 12px-radius card of SettingsRows with inset hairlines. */
export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  return (
    <section className={styles.group}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <div className={styles.card}>{children}</div>
      {footer ? <p className={styles.footer}>{footer}</p> : null}
    </section>
  );
}
