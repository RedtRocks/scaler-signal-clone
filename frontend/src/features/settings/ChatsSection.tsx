"use client";

import { SettingsGroup } from "@/components/ui";
import { ToggleRow } from "./Rows";

export function ChatsSection() {
  return (
    <SettingsGroup title="Text input" footer="Saved on this device. When Enter sends is off, Enter starts a new line and Ctrl or Cmd+Enter sends.">
      <ToggleRow pref="enterSends" label="Enter sends message" sublabel="Shift+Enter adds a new line." />
    </SettingsGroup>
  );
}
