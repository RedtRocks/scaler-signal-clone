"use client";

import { Button, Modal } from "@/components/ui";
import { SHORTCUTS } from "@/features/shell/shortcuts";
import { useDialogStore } from "./dialogStore";
import styles from "./Dialogs.module.css";

const isApple = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** The keyboard shortcuts, in the order Signal Desktop lists its own. */
export function ShortcutsDialog() {
  const close = useDialogStore((s) => s.close);
  const keyLabel = (key: string) => (key === "mod" ? (isApple() ? "⌘" : "Ctrl") : key === "Alt" && isApple() ? "⌥" : key);

  return (
    <Modal title="Keyboard shortcuts" onClose={close} actions={<Button onClick={close}>Close</Button>}>
      <dl className={styles.shortcuts}>
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.id} className={styles.shortcutRow}>
            <dt>{shortcut.label}</dt>
            <dd>
              {shortcut.keys.map((key) => (
                <kbd key={key} className={styles.kbd}>
                  {keyLabel(key)}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
