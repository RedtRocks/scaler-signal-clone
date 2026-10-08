import type { ReactNode } from "react";
import styles from "./EmptyChatPane.module.css";

export interface EmptyChatPaneProps {
  title?: string;
  /** Extra content under the copy (links, buttons). */
  children?: ReactNode;
}

/** The pane Signal Desktop shows when no chat is selected. */
export function EmptyChatPane({ title = "Welcome to Signal", children }: EmptyChatPaneProps) {
  return (
    <div className={styles.pane}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
      <img className={styles.logo} src="/logos/Signal-Logo-Ultramarine.svg" alt="" width={96} height={96} />
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.copy}>Select a chat to start messaging, or start a new one with the compose button.</p>
      {children ? <div className={styles.extra}>{children}</div> : null}
    </div>
  );
}
