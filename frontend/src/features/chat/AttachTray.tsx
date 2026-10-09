import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import styles from "./AttachTray.module.css";

export type AttachChoice = "photos" | "gif" | "file" | "contact" | "location";

const GLYPHS: Record<AttachChoice, ReactNode> = {
  photos: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="15" height="12" rx="2.5" />
      <path d="M6 6V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1M3 15l4-4 4 4M13.5 12.5l1.5-1.5 3 3" />
    </svg>
  ),
  gif: <span className={styles.gif}>GIF</span>,
  file: <Icon name="file" size={26} />,
  contact: <Icon name="user" size={26} />,
  location: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  ),
};

const LABELS: Record<AttachChoice, string> = { photos: "Photos", gif: "GIF", file: "File", contact: "Contact", location: "Location" };

/** The phone attach sheet: round buttons with a caption each, like Signal iOS. */
export function AttachTray({ onChoose }: { onChoose: (choice: AttachChoice) => void }) {
  return (
    <div className={styles.tray} role="menu" aria-label="Attach">
      {(Object.keys(GLYPHS) as AttachChoice[]).map((choice) => (
        <button key={choice} type="button" role="menuitem" className={styles.item} onClick={() => onChoose(choice)}>
          <span className={styles.circle}>{GLYPHS[choice]}</span>
          <span className={styles.label}>{LABELS[choice]}</span>
        </button>
      ))}
    </div>
  );
}
