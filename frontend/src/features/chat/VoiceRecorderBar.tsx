import { Button, Icon } from "@/components/ui";
import { formatClock } from "@/lib/attachments";
import styles from "./VoiceRecorderBar.module.css";

interface VoiceRecorderBarProps {
  elapsedMs: number;
  onCancel: () => void;
  onSend: () => void;
}

/** Replaces the message box while recording: trash, a pulsing red dot with the time, and send. */
export function VoiceRecorderBar({ elapsedMs, onCancel, onSend }: VoiceRecorderBarProps) {
  return (
    <div className={styles.bar} role="group" aria-label="Recording a voice message">
      <Button variant="icon" icon="trash" iconSize={22} aria-label="Discard recording" onClick={onCancel} />
      <div className={styles.field}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.time} role="timer" aria-live="off">
          {formatClock(elapsedMs)}
        </span>
        <span className={styles.hint}>Recording…</span>
      </div>
      <button type="button" className={styles.send} aria-label="Send voice message" onClick={onSend}>
        <Icon name="send" size={36} />
      </button>
    </div>
  );
}
