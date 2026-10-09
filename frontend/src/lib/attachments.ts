// Pure helpers for attachments: what may be sent, how it is described, and how images are laid out.
import type { Attachment, Message, ReplyPreview } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

/** Mirrors the server allowlist (docs/CONTRACT.md → Attachments). */
const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  zip: "application/zip",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  weba: "audio/webm",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const ALLOWED_TYPES = new Set(Object.values(TYPE_BY_EXTENSION));
const TYPE_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "application/x-zip-compressed": "application/zip",
  "audio/x-wav": "audio/wav",
  "audio/mp3": "audio/mpeg",
};

export const FILE_PICKER_ACCEPT = Object.keys(TYPE_BY_EXTENSION)
  .map((ext) => `.${ext}`)
  .join(",");

const extensionOf = (name: string): string => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** The content type to send for a file: the browser's if allowed, else guessed from the extension. */
export function contentTypeOf(file: { name: string; type: string }): string | null {
  const declared = file.type.split(";")[0].trim().toLowerCase();
  const canonical = TYPE_ALIASES[declared] ?? declared;
  if (ALLOWED_TYPES.has(canonical)) return canonical;
  return TYPE_BY_EXTENSION[extensionOf(file.name)] ?? null;
}

/** A recorded voice message: audio the sender gave a length, drawn with a waveform and play button. */
export type VoiceFile = File & { durationMs?: number };
export const withDuration = (file: File, durationMs: number): VoiceFile => Object.assign(file, { durationMs });
export const durationOf = (file: File): number | undefined => (file as VoiceFile).durationMs;
export const isVoice = (attachment: Pick<Attachment, "content_type" | "duration_ms">): boolean =>
  attachment.content_type.startsWith("audio/") && typeof attachment.duration_ms === "number";

/** "0:07", "1:32", "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export const isImageType = (contentType: string): boolean => contentType.startsWith("image/");
export const isImage = (attachment: Pick<Attachment, "content_type">): boolean => isImageType(attachment.content_type);

/** Why a file can't be sent, or null when it can. */
export function fileProblem(file: { name: string; size: number; type: string }): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 10 MB.`;
  if (contentTypeOf(file) === null) return `${file.name} can't be sent: this type of file isn't supported.`;
  return null;
}

/** Splits picked files into those to keep (respecting the 10 attachment cap) and human-readable problems. */
export function acceptFiles<T extends { name: string; size: number; type: string }>(
  incoming: readonly T[],
  alreadyStaged: number,
): { accepted: T[]; problems: string[] } {
  const accepted: T[] = [];
  const problems: string[] = [];
  for (const file of incoming) {
    const problem = fileProblem(file);
    if (problem) problems.push(problem);
    else if (alreadyStaged + accepted.length >= MAX_ATTACHMENTS) {
      problems.push(`You can attach up to ${MAX_ATTACHMENTS} files to one message.`);
      break;
    } else accepted.push(file);
  }
  return { accepted, problems: [...new Set(problems)] };
}

/** "832 B", "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** What stands in for the text of a message that only carries files, Signal style. */
export function attachmentLabel(
  attachments: readonly Pick<Attachment, "content_type" | "file_name" | "duration_ms">[],
): string {
  if (attachments.length === 0) return "";
  if (attachments.every(isImage)) return attachments.length === 1 ? "📷 Photo" : `📷 ${attachments.length} photos`;
  if (attachments.length === 1 && isVoice(attachments[0])) return "🎤 Voice Message";
  return attachments.length === 1 ? "📎 File" : `📎 ${attachments.length} files`;
}

/** The one-line text for chat list rows, quotes and search hits: the caption, else the label. */
export function messageSummary(message: Pick<Message, "body" | "attachments">): string {
  return message.body || attachmentLabel(message.attachments ?? []);
}

/** Same for a quoted message. */
export function quoteSummary(reply: Pick<ReplyPreview, "body" | "attachment">): string {
  return reply.body || attachmentLabel(reply.attachment ? [reply.attachment] : []);
}

/** Aspect ratio (w/h) used to size a single image, kept within a range so extremes stay tidy. */
export function clampedAspect(width: number | null, height: number | null): number {
  if (!width || !height) return 4 / 3;
  return Math.min(Math.max(width / height, 0.75), 1.9);
}

export interface ImageGridPlan {
  /** Images drawn as tiles. */
  shown: number;
  /** Images beyond the tiles, shown as "+N" on the last one. */
  extra: number;
  layout: "single" | "pair" | "trio" | "quad";
}

/** Signal-style grid: 1 big, 2 side by side, 3 = one tall + two stacked, 4+ = 2x2 with "+N". */
export function planImageGrid(count: number): ImageGridPlan {
  if (count <= 1) return { shown: Math.max(count, 0), extra: 0, layout: "single" };
  if (count === 2) return { shown: 2, extra: 0, layout: "pair" };
  if (count === 3) return { shown: 3, extra: 0, layout: "trio" };
  return { shown: 4, extra: count - 4, layout: "quad" };
}

/** Natural size of an image file, or null when the browser can't decode it. */
export function measureImage(url: string): Promise<{ width: number; height: number } | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}
