"use client";

import { MenuList, Popover, ReactionPicker, type MenuEntry } from "@/components/ui";
import styles from "./MessageContextMenu.module.css";

interface MessageContextMenuProps {
  position: { x: number; y: number } | null;
  items: MenuEntry[];
  selectedReaction?: string;
  onReact: (emoji: string) => void;
  onClose: () => void;
}

/** Right-click (desktop) or long-press (phone) menu: quick reactions above the actions. */
export function MessageContextMenu({ position, items, selectedReaction, onReact, onClose }: MessageContextMenuProps) {
  return (
    <Popover open={!!position} anchor={position} onClose={onClose} placement="bottom-start" offset={0} className={styles.still}>
      <div className={styles.stack}>
        <ReactionPicker
          selected={selectedReaction}
          onSelect={(emoji) => {
            onClose();
            onReact(emoji);
          }}
        />
        <MenuList items={items} onClose={onClose} aria-label="Message actions" />
      </div>
    </Popover>
  );
}
