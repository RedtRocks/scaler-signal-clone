import { Icon } from "../Icon/Icon";
import styles from "./StagedAttachments.module.css";

export interface StagedItem {
  key: string | number;
  name: string;
  /** Preview url for images; omit for other files. */
  previewSrc?: string;
  /** "1.2 MB". */
  detail: string;
}

export interface StagedAttachmentsProps {
  items: StagedItem[];
  onRemove: (key: StagedItem["key"]) => void;
}

/** The strip above the composer input: files waiting to be sent, each removable. */
export function StagedAttachments({ items, onRemove }: StagedAttachmentsProps) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.strip} aria-label="Attachments to send">
      {items.map((item) => (
        <li key={item.key} className={item.previewSrc ? styles.item : `${styles.item} ${styles.fileItem}`}>
          {item.previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: preview
            <img className={styles.thumb} src={item.previewSrc} alt={item.name} draggable={false} />
          ) : (
            <>
              <span className={styles.fileIcon}>
                <Icon name="file" size={22} />
              </span>
              <span className={styles.fileText}>
                <span className={styles.fileName}>{item.name}</span>
                <span className={styles.fileDetail}>{item.detail}</span>
              </span>
            </>
          )}
          <button type="button" className={styles.remove} aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.key)}>
            <Icon name="close" size={12} strokeWidth={2.4} />
          </button>
        </li>
      ))}
    </ul>
  );
}
