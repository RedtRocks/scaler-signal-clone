import clsx from "clsx";
import type { ReactNode } from "react";
import { Icon } from "../Icon/Icon";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: number;
  kind?: "note" | "group";
  online?: boolean;
  className?: string;
}

const GROUP_GLYPH =
  "M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 14.5a5.5 5.5 0 0 1 11 0v1h-11zM5.5 11a2.5 2.5 0 1 0 0-5M2 18v-1a4 4 0 0 1 3-3.8";

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

export function Avatar({ name, src, size = 48, kind, online, className }: AvatarProps) {
  let variant: string | undefined;
  let inner: ReactNode;
  if (kind === "note") {
    variant = styles.note;
    inner = <Icon name="note" size={Math.round(size * 0.5)} />;
  } else if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars are arbitrary user URLs / blobs
    inner = <img src={src} alt="" className={styles.img} />;
  } else if (kind === "group") {
    variant = styles.group;
    inner = (
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        aria-hidden
      >
        <path d={GROUP_GLYPH} />
      </svg>
    );
  } else {
    variant = styles.initials;
    inner = initials(name);
  }

  return (
    <span
      className={clsx(styles.avatar, variant, "sg-avatar", className)}
      role="img"
      aria-label={name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      {inner}
      {online ? <span className={styles.online} aria-label="online" /> : null}
    </span>
  );
}
