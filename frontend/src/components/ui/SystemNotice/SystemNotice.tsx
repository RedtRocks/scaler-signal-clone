import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import styles from "./SystemNotice.module.css";

export interface SystemNoticeProps {
  icon?: IconName;
  className?: string;
  children: ReactNode;
}

/** Centred grey timeline line: "Maya added Kai.", timer changes, day dividers. */
export function SystemNotice({ icon, className, children }: SystemNoticeProps) {
  return (
    <div className={clsx(styles.system, className)} role="note">
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
    </div>
  );
}
