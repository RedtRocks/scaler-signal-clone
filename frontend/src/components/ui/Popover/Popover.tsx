"use client";

import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Popover.module.css";

export type PopoverAnchor = HTMLElement | { x: number; y: number };
export type PopoverPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "top" | "bottom";

export interface PopoverProps {
  open: boolean;
  anchor: PopoverAnchor | null;
  onClose: () => void;
  placement?: PopoverPlacement;
  offset?: number;
  /** Focus the first focusable child on open and restore focus on close. */
  autoFocus?: boolean;
  className?: string;
  children: ReactNode;
}

const noop = () => () => {};
/** true on the client after hydration, false during SSR. */
export function useIsClient() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

const MARGIN = 8;

function anchorRect(anchor: PopoverAnchor) {
  if (anchor instanceof HTMLElement) return anchor.getBoundingClientRect();
  return new DOMRect(anchor.x, anchor.y, 0, 0);
}

/** Floating layer portalled to <body>, positioned against an element or a point, flipping to stay on screen. */
export function Popover({
  open,
  anchor,
  onClose,
  placement = "bottom-start",
  offset = 6,
  autoFocus = true,
  className,
  children,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el || !anchor) return;
    const a = anchorRect(anchor);
    const { width: w, height: h } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = placement.startsWith("top") ? a.top - h - offset : a.bottom + offset;
    if (placement.startsWith("top") && top < MARGIN) top = a.bottom + offset;
    if (placement.startsWith("bottom") && top + h > vh - MARGIN) top = Math.max(MARGIN, a.top - h - offset);
    let left = placement.endsWith("end")
      ? a.right - w
      : placement === "top" || placement === "bottom"
        ? a.left + a.width / 2 - w / 2
        : a.left;
    left = Math.min(Math.max(MARGIN, left), vw - w - MARGIN);
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
    el.style.visibility = "visible";
    if (autoFocus) {
      el.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), button, [tabindex="0"]')?.focus();
    }
  }, [open, anchor, placement, offset, autoFocus]);

  useEffect(() => {
    if (!open) return;
    const restore = anchor instanceof HTMLElement ? anchor : (document.activeElement as HTMLElement | null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (anchor instanceof HTMLElement && anchor.contains(t)) return; // trigger toggles itself
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const onScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    const onResize = () => onCloseRef.current();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      if (autoFocus && restore && document.contains(restore)) restore.focus();
    };
  }, [open, anchor, autoFocus]);

  if (!open || !isClient || !anchor) return null;
  return createPortal(
    <div ref={ref} className={clsx(styles.popover, className)} style={{ visibility: "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}
