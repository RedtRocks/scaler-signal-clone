"use client";

import { SettingsGroup } from "@/components/ui";
import { ToggleRow } from "./Rows";

export function CallsSection() {
  return (
    <SettingsGroup footer="Calls are simulated in this build (no audio or video is sent). These switches are saved on this device.">
      <ToggleRow pref="incomingCalls" label="Enable incoming calls" />
      <ToggleRow pref="callSounds" label="Play calling sounds" />
    </SettingsGroup>
  );
}
