"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button/Button";
import { useIsClient } from "../Popover/Popover";
import styles from "./Modal.module.css";

export interface ModalProps {
  title: string;
  open?: boolean;
  /** Render in place (no portal / fixed scrim), for previews. */
  inline?: boolean;
  onClose?: () => void;
  /** Bottom-right buttons: secondary first, then primary. */
  actions?: ReactNode;
  /** Full-screen sheet below 600px (default true). */
  sheetOnPhone?: boolean;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, open = true, inline, onClose, actions, sheetOnPhone = true, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const titleId = useId();

  // Initial focus + restore focus on close.
  useEffect(() => {
    if (!open || inline) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const nodes = el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    const first =
      el?.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ??
      nodes.find((n) => !n.dataset.close) ??
      el;
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, inline]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const dialog = (
    <div
      className={clsx(styles.scrim, inline && styles.inline, sheetOnPhone && !inline && styles.sheet)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={ref}
        className={styles.modal}
        role="dialog"
        aria-modal={inline ? undefined : true}
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.head}>
          <h2 id={titleId}>{title}</h2>
          {onClose ? (
            <Button variant="icon" icon="close" iconSize={20} aria-label="Close" data-close="true" onClick={onClose} />
          ) : null}
        </div>
        <div className={styles.body}>{children}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  );

  if (inline) return dialog;
  if (!isClient) return null;
  return createPortal(dialog, document.body);
}
