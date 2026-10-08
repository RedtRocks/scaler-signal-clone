"use client";

import { SettingsGroup, SettingsRow, Switch } from "@/components/ui";
import { usePreference } from "./preferences";

export function NotificationsSection() {
  const [desktop, setDesktop] = usePreference("notifyDesktop");
  const [preview, setPreview] = usePreference("notifyPreview");
  const [sound, setSound] = usePreference("notifySound");
  return (
    <>
      <SettingsGroup footer="These switches are saved on this device only. This build does not send push notifications yet. Mute a single chat from its menu.">
        <SettingsRow
          label="Show Notifications"
          control={<Switch checked={desktop} onChange={setDesktop} label="Show notifications" />}
        />
        <SettingsRow
          label="Show Message Preview"
          control={<Switch checked={preview} onChange={setPreview} label="Show message preview" />}
        />
        <SettingsRow
          label="Message Sounds"
          control={<Switch checked={sound} onChange={setSound} label="Message sounds" />}
        />
      </SettingsGroup>
    </>
  );
}
