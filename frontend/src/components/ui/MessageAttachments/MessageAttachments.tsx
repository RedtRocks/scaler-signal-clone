import clsx from "clsx";
import { Icon } from "../Icon/Icon";
import { VoiceMessage } from "../VoiceMessage/VoiceMessage";
import styles from "./MessageAttachments.module.css";

export interface MediaImage {
  key: string | number;
  src: string;
  /** File name, used as the alt text. */
  name: string;
  /** width / height, already clamped; only the single-image layout uses it. */
  aspect: number;
  /** 0..1 while uploading; omit when stored. */
  progress?: number;
}

export interface MediaFile {
  key: string | number;
  name: string;
  /** "1.2 MB · PDF". */
  detail: string;
  /** Short type label drawn on the file icon ("PDF", "ZIP"); omit for a generic file glyph. */
  badge?: string;
  progress?: number;
}

export interface MediaVoice {
  key: string | number;
  src: string;
  durationMs: number;
  seed: number;
  incoming: boolean;
  uploading: boolean;
}

export interface MessageAttachmentsProps {
  /** Voice messages, drawn first, each with a waveform. */
  voices?: MediaVoice[];
  formatClock?: (ms: number) => string;
  images: MediaImage[];
  /** How the tiles are arranged. */
  layout: "single" | "pair" | "trio" | "quad";
  /** Images beyond the tiles, drawn as "+N" over the last tile. */
  extra?: number;
  files: MediaFile[];
  onImageClick?: (index: number) => void;
  onFileClick?: (index: number) => void;
}

/** A ring that fills while a file uploads. */
function UploadRing({ progress }: { progress: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <span className={styles.uploading} role="progressbar" aria-label="Uploading" aria-valuenow={Math.round(progress * 100)}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
        <circle
          className={styles.ringValue}
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.06, progress))}
          transform="rotate(-90 20 20)"
        />
      </svg>
    </span>
  );
}

const isUploading = (progress: number | undefined) => progress !== undefined && progress < 1;

/** The media of one message: an image grid (Signal style) followed by file rows. */
export function MessageAttachments({
  images,
  layout,
  extra = 0,
  files,
  voices = [],
  formatClock = (ms) => `${Math.round(ms / 1000)}s`,
  onImageClick,
  onFileClick,
}: MessageAttachmentsProps) {
  return (
    <div className={clsx(styles.root, images.length > 0 && styles.withImages)}>
      {voices.map((voice) => (
        <VoiceMessage
          key={voice.key}
          src={voice.src}
          durationMs={voice.durationMs}
          seed={Number(voice.key) || 1}
          incoming={voice.incoming}
          uploading={voice.uploading}
          formatClock={formatClock}
        />
      ))}
      {images.length > 0 ? (
        <div
          className={clsx(styles.grid, styles[layout])}
          style={layout === "single" ? { aspectRatio: String(images[0].aspect) } : undefined}
        >
          {images.map((image, index) => (
            <button
              key={image.key}
              type="button"
              className={styles.tile}
              aria-label={`Open ${image.name}`}
              onClick={() => onImageClick?.(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: and API-origin urls; next/image can't optimise them */}
              <img className={styles.img} src={image.src} alt={image.name} draggable={false} />
              {isUploading(image.progress) ? <UploadRing progress={image.progress!} /> : null}
              {extra > 0 && index === images.length - 1 ? <span className={styles.extra}>+{extra}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {files.map((file, index) => (
        <button key={file.key} type="button" className={styles.file} onClick={() => onFileClick?.(index)} aria-label={`Download ${file.name}`}>
          <span className={clsx(styles.fileIcon, file.badge && styles.fileBadge)}>
            {isUploading(file.progress) ? (
              <UploadRing progress={file.progress!} />
            ) : file.badge ? (
              <span className={styles.badgeText}>{file.badge}</span>
            ) : (
              <Icon name="file" size={22} />
            )}
          </span>
          <span className={styles.fileText}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileDetail}>{file.detail}</span>
          </span>
          {isUploading(file.progress) || file.badge ? null : <Icon name="download" size={20} className={styles.fileDownload} />}
        </button>
      ))}
    </div>
  );
}
