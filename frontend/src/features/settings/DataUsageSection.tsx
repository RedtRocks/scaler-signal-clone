"use client";

import { SettingsGroup } from "@/components/ui";
import { ToggleRow } from "./Rows";

export function DataUsageSection() {
  return (
    <SettingsGroup title="Media auto-download" footer="Voice messages are always auto-downloaded. Saved on this device; this build always loads attachments.">
      <ToggleRow pref="dlPhotos" label="Photos" />
      <ToggleRow pref="dlVideos" label="Videos" />
      <ToggleRow pref="dlAudio" label="Audio" />
      <ToggleRow pref="dlDocuments" label="Documents" />
    </SettingsGroup>
  );
}
