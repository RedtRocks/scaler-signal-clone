"use client";

import clsx from "clsx";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "../Button/Button";
import { Icon, type IconName } from "../Icon/Icon";
import { Popover, type PopoverPlacement } from "../Popover/Popover";
import styles from "./Menu.module.css";

export interface MenuItem {
  id?: string;
  label: string;
  icon?: IconName;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}
/** A menu entry, or "separator" for a hairline between groups. */
export type MenuEntry = MenuItem | "separator";

export interface MenuListProps {
  items: MenuEntry[];
  onClose?: () => void;
  "aria-label"?: string;
}

/** The menu surface itself (role=menu, arrow-key navigation). Used by DropdownMenu and ContextMenu. */
export function MenuList({ items, onClose, "aria-label": ariaLabel }: MenuListProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => nodes[(n + nodes.length) % nodes.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(nodes.length - 1);
    else if (e.key === "Tab") onClose?.();
    else return;
    e.preventDefault();
  };
  return (
    <div className={styles.menu} role="menu" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {items.map((it, i) =>
        it === "separator" ? (
          <div key={`sep-${i}`} className={styles.separator} role="separator" />
        ) : (
          <button
            key={it.id ?? it.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={it.disabled || undefined}
            className={clsx(styles.item, it.destructive && styles.destructive)}
            onClick={() => {
              if (it.disabled) return;
              onClose?.();
              it.onSelect();
            }}
          >
            {it.icon ? <Icon name={it.icon} size={20} /> : null}
            <span>{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

export interface DropdownMenuProps {
  items: MenuEntry[];
  /** Accessible name of the trigger. */
  label?: string;
  icon?: IconName;
  placement?: PopoverPlacement;
  /** Custom trigger; receives the props to spread onto a button. */
  renderTrigger?: (props: {
    ref: (el: HTMLButtonElement | null) => void;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-label": string;
  }) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/** ⋯ button that opens a menu below it. */
export function DropdownMenu({
  items,
  label = "More",
  icon = "more",
  placement = "bottom-end",
  renderTrigger,
  onOpenChange,
}: DropdownMenuProps) {
  const [open, setOpenState] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const triggerProps = {
    ref: setAnchor,
    onClick: () => setOpen(!open),
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-label": label,
  };
  return (
    <>
      {renderTrigger ? (
        renderTrigger(triggerProps)
      ) : (
        <Button variant="icon" icon={icon} {...triggerProps} data-open={open || undefined} />
      )}
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} placement={placement}>
        <MenuList items={items} onClose={() => setOpen(false)} aria-label={label} />
      </Popover>
    </>
  );
}

export interface ContextMenuProps {
  /** Viewport point (e.g. from onContextMenu's clientX/clientY). null = closed. */
  position: { x: number; y: number } | null;
  items: MenuEntry[];
  onClose: () => void;
  label?: string;
}

/** Right-click / long-press menu at a point. Controlled. */
export function ContextMenu({ position, items, onClose, label = "Message actions" }: ContextMenuProps) {
  return (
    <Popover open={!!position} anchor={position} onClose={onClose} placement="bottom-start" offset={0}>
      <MenuList items={items} onClose={onClose} aria-label={label} />
    </Popover>
  );
}

/** Small helper for ContextMenu state: spread `onContextMenu` on the target. */
export function useContextMenu() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  return {
    position,
    onContextMenu: (e: { preventDefault: () => void; clientX: number; clientY: number }) => {
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
    },
    close: () => setPosition(null),
  };
}
