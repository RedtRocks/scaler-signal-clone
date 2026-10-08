import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";
import styles from "./SettingsRow.module.css";

export interface SettingsRowProps {
  label: string;
  sublabel?: string;
  value?: ReactNode;
  icon?: IconName;
  avatar?: ReactNode;
  destructive?: boolean;
  /** Chevron is on by default (off for destructive rows and rows with `control`). */
  chevron?: boolean;
  /** Trailing interactive control (Switch). The row then renders as a <label>-like div. */
  control?: ReactNode;
  onClick?: () => void;
}

export function SettingsRow({
  label,
  sublabel,
  value,
  icon,
  avatar,
  destructive,
  chevron,
  control,
  onClick,
}: SettingsRowProps) {
  const lead = avatar ? (
    <span className={clsx(styles.lead, styles.leadAvatar)}>{avatar}</span>
  ) : icon ? (
    <span className={styles.lead}>
      {icon === "add-member" ? (
        <span className={styles.add}>
          <Icon name="plus" size={18} />
        </span>
      ) : (
        <Icon name={icon} size={24} />
      )}
    </span>
  ) : null;
  const showChevron = chevron ?? (!destructive && !control);
  const content = (
    <>
      {lead}
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {sublabel ? <span className={styles.sub}>{sublabel}</span> : null}
      </span>
      {value != null ? <span className={styles.value}>{value}</span> : null}
      {control}
      {showChevron ? <Icon name="chevron-right" size={18} className={styles.chevron} /> : null}
    </>
  );
  const cls = clsx(styles.row, !lead && styles.noLead, destructive && styles.destructive, !onClick && !control && styles.static);
  if (control) return <div className={cls}>{content}</div>;
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}
