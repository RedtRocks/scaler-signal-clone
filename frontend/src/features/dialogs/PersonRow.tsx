import clsx from "clsx";
import type { ReactNode } from "react";
import { Avatar, Icon, type IconName } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import type { Contact } from "@/lib/types";
import styles from "./Dialogs.module.css";

/** A tappable Contact row; `selected` turns it into a checkbox row (new group). */
export function ContactRow({
  contact,
  selected,
  disabled,
  onClick,
}: {
  contact: Contact;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.item}
        onClick={onClick}
        disabled={disabled}
        role={selected === undefined ? undefined : "checkbox"}
        aria-checked={selected}
      >
        <Avatar name={contact.display_name} src={mediaUrl(contact.user.avatar_url) ?? undefined} size={40} />
        <span className={styles.text}>
          <span className={styles.name}>{contact.display_name}</span>
          <span className={styles.sub}>{contact.user.about || contact.user.phone}</span>
        </span>
        {selected === undefined ? null : (
          <span className={clsx(styles.check, selected && styles.checked)}>
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        )}
      </button>
    </li>
  );
}

/** An action row with a round glyph ("New group", "Message +1 555…"). */
export function ActionRow({
  icon,
  label,
  sub,
  disabled,
  onClick,
  children,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <li>
      <button type="button" className={styles.item} onClick={onClick} disabled={disabled}>
        <span className={styles.glyph}>
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{label}</span>
          {sub ? <span className={styles.sub}>{sub}</span> : null}
        </span>
        {children}
      </button>
    </li>
  );
}
