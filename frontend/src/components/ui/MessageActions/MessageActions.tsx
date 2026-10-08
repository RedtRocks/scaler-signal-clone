"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button } from "../Button/Button";
import { DropdownMenu, type MenuEntry } from "../Menu/Menu";
import { Popover } from "../Popover/Popover";
import { ReactionPicker } from "../ReactionPicker/ReactionPicker";
import styles from "./MessageActions.module.css";

export interface MessageActionsProps {
  /** Outgoing messages show the toolbar on the bubble's left, mirrored. */
  direction?: "incoming" | "outgoing";
  /** Your current reaction (highlighted in the picker). */
  selectedReaction?: string;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  /** The ⋯ menu: e.g. Reply, Copy text, Delete for everyone, Info. */
  menuItems?: MenuEntry[];
  className?: string;
}

/** Desktop hover toolbar beside a bubble: react, reply, more. */
export function MessageActions({
  direction = "incoming",
  selectedReaction,
  onReact,
  onReply,
  menuItems,
  className,
}: MessageActionsProps) {
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const open = !!pickerAnchor || menuOpen;
  return (
    <div
      className={clsx(styles.actions, direction === "outgoing" && styles.reverse, className)}
      data-open={open || undefined}
    >
      {onReact ? (
        <Button
          variant="icon"
          icon="react"
          iconSize={20}
          className={styles.btn}
          aria-label="React"
          aria-haspopup="true"
          aria-expanded={!!pickerAnchor}
          onClick={(e) => setPickerAnchor(pickerAnchor ? null : e.currentTarget)}
        />
      ) : null}
      {onReply ? (
        <Button variant="icon" icon="reply" iconSize={20} className={styles.btn} aria-label="Reply" onClick={onReply} />
      ) : null}
      {menuItems?.length ? (
        <DropdownMenu
          items={menuItems}
          label="More actions"
          placement={direction === "outgoing" ? "bottom-end" : "bottom-start"}
          onOpenChange={setMenuOpen}
          renderTrigger={(p) => (
            <Button variant="icon" icon="more" iconSize={20} className={styles.btn} {...p} />
          )}
        />
      ) : null}
      {onReact ? (
        <Popover open={!!pickerAnchor} anchor={pickerAnchor} onClose={() => setPickerAnchor(null)} placement="top">
          <ReactionPicker
            selected={selectedReaction}
            onSelect={(e) => {
              setPickerAnchor(null);
              onReact(e);
            }}
          />
        </Popover>
      ) : null}
    </div>
  );
}
