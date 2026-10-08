import { mediaUrl } from "@/lib/config";
import type { Attachment } from "@/lib/types";

/**
 * Saves an attachment under its original file name. The `download` attribute is ignored for
 * links to another origin (the API), so the bytes are fetched and saved from a blob URL.
 */
export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const response = await fetch(mediaUrl(attachment.url) ?? attachment.url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.file_name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
