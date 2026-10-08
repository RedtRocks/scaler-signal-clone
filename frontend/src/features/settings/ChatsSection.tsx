"use client";

import { SettingsGroup, SettingsRow, Switch } from "@/components/ui";
import { usePreference } from "./preferences";

export function ChatsSection() {
  const [enterSends, setEnterSends] = usePreference("enterSends");
  return (
    <SettingsGroup footer="Saved on this device. When off, Enter starts a new line.">
      <SettingsRow
        label="Enter Sends Message"
        control={<Switch checked={enterSends} onChange={setEnterSends} label="Enter sends message" />}
      />
    </SettingsGroup>
  );
}
