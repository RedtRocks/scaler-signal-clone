"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";
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

// Two people, the front one full size: Signal's group placeholder. Filled, on a 24px grid.
const GROUP_GLYPH = [
  "M9.5 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5z",
  "M2.5 19.25c0-3.45 3.13-5.75 7-5.75s7 2.3 7 5.75c0 .41-.34.75-.75.75H3.25a.75.75 0 0 1-.75-.75z",
  "M16.25 11a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8z",
  "M17.9 13.1c2.1.45 3.6 1.95 3.6 4.15 0 .41-.34.75-.75.75H18c0-1.95-.7-3.6-2.05-4.75.6-.12 1.28-.17 1.95-.15z",
].join("");

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
  // A photo that fails to load falls back to initials instead of a broken-image box.
  const [failed, setFailed] = useState<string>();
  let variant: string | undefined;
  let inner: ReactNode;
  if (kind === "note") {
    variant = styles.note;
    inner = <Icon name="note" size={Math.round(size * 0.5)} />;
  } else if (src && failed !== src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars are arbitrary user URLs / blobs
    inner = <img src={src} alt="" className={styles.img} onError={() => setFailed(src)} />;
  } else if (kind === "group") {
    variant = styles.group;
    inner = (
      <svg
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        viewBox="0 0 24 24"
        fill="currentColor"
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
