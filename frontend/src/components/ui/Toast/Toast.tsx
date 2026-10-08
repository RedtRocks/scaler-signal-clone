import type { ReactNode } from "react";
import styles from "./Toast.module.css";

export interface ToastProps {
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}

export function Toast({ action, onAction, children }: ToastProps) {
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span>{children}</span>
      {action ? (
        <button type="button" className={styles.action} onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
