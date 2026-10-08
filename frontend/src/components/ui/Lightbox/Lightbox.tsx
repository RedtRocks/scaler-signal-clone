"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon/Icon";
import { useIsClient } from "../Popover/Popover";
import styles from "./Lightbox.module.css";

export interface LightboxItem {
  key: string | number;
  src: string;
  name: string;
}

export interface LightboxProps {
  items: LightboxItem[];
  /** Index of the item being shown. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDownload?: (item: LightboxItem) => void;
}

/** Full-screen image viewer: arrow keys / buttons to move, Esc to close, download. */
export function Lightbox({ items, index, onIndexChange, onClose, onDownload }: LightboxProps) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const item = items[index];
  const count = items.length;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  if (!isClient || !item) return null;

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < count) onIndexChange(next);
  };

  return createPortal(
    <div
      ref={ref}
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowLeft") go(-1);
        else if (event.key === "ArrowRight") go(1);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={styles.bar}>
        <span className={styles.title}>
          {item.name}
          {count > 1 ? <span className={styles.count}>{` · ${index + 1} of ${count}`}</span> : null}
        </span>
        {onDownload ? (
          <button type="button" className={styles.iconButton} aria-label="Download" onClick={() => onDownload(item)}>
            <Icon name="download" size={22} />
          </button>
        ) : null}
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={onClose}>
          <Icon name="close" size={22} />
        </button>
      </header>
      <div className={styles.stage} onClick={(event) => event.target === event.currentTarget && onClose()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- blob: and API-origin urls */}
        <img key={item.key} className={styles.image} src={item.src} alt={item.name} draggable={false} />
      </div>
      {index > 0 ? (
        <button type="button" className={`${styles.nav} ${styles.prev}`} aria-label="Previous image" onClick={() => go(-1)}>
          <Icon name="chevron-left" size={28} />
        </button>
      ) : null}
      {index < count - 1 ? (
        <button type="button" className={`${styles.nav} ${styles.next}`} aria-label="Next image" onClick={() => go(1)}>
          <Icon name="chevron-forward" size={28} />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
