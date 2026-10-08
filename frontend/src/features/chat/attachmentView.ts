// Turns a message's Attachments into what the presentational media components draw.
import type { MediaFile, MediaImage } from "@/components/ui";
import { clampedAspect, formatFileSize, isImage, planImageGrid, type ImageGridPlan } from "@/lib/attachments";
import { mediaUrl } from "@/lib/config";
import type { Attachment } from "@/lib/types";

export interface MediaView {
  images: MediaImage[];
  layout: ImageGridPlan["layout"];
  extra: number;
  files: MediaFile[];
  /** Every image of the message (the lightbox pages through all, not only the tiles). */
  imageAttachments: Attachment[];
  /** Non-image attachments, in the same order as `files`. */
  fileAttachments: Attachment[];
}

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain": "Text",
  "application/zip": "ZIP",
};

function typeLabel(contentType: string): string {
  if (TYPE_LABEL[contentType]) return TYPE_LABEL[contentType];
  const group = contentType.split("/")[0];
  return group === "audio" ? "Audio" : group === "video" ? "Video" : "File";
}

/** `progress[i]` is the upload progress of `attachments[i]` while the message is still sending. */
export function mediaView(attachments: readonly Attachment[], progress?: readonly number[]): MediaView {
  const imageAttachments: Attachment[] = [];
  const fileAttachments: Attachment[] = [];
  const imageProgress: (number | undefined)[] = [];
  const fileProgress: (number | undefined)[] = [];
  attachments.forEach((attachment, index) => {
    const value = progress?.[index];
    if (isImage(attachment)) {
      imageAttachments.push(attachment);
      imageProgress.push(value);
    } else {
      fileAttachments.push(attachment);
      fileProgress.push(value);
    }
  });
  const plan = planImageGrid(imageAttachments.length);
  return {
    images: imageAttachments.slice(0, plan.shown).map((attachment, index) => ({
      key: attachment.id,
      src: mediaUrl(attachment.url) ?? attachment.url,
      name: attachment.file_name,
      aspect: clampedAspect(attachment.width, attachment.height),
      progress: imageProgress[index],
    })),
    layout: plan.layout,
    extra: plan.extra,
    files: fileAttachments.map((attachment, index) => ({
      key: attachment.id,
      name: attachment.file_name,
      detail: `${formatFileSize(attachment.size)} · ${typeLabel(attachment.content_type)}`,
      progress: fileProgress[index],
    })),
    imageAttachments,
    fileAttachments,
  };
}
