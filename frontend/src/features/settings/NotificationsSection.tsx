"use client";

import { SettingsGroup } from "@/components/ui";
import { ToggleRow } from "./Rows";

export function NotificationsSection() {
  return (
    <>
      <SettingsGroup footer="These switches are saved on this device only. This build does not send push notifications yet. Mute a single chat from its menu.">
        <ToggleRow pref="notifyDesktop" label="Enable notifications" />
        <ToggleRow pref="notifyPreview" label="Show message preview" sublabel="Show the sender and text in notifications." />
        <ToggleRow pref="notifyReactions" label="Reaction notifications" sublabel="Notify when someone reacts to your message." />
      </SettingsGroup>
      <SettingsGroup title="Sounds">
        <ToggleRow pref="notifySound" label="Message sounds" />
      </SettingsGroup>
    </>
  );
}
