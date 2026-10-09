"use client";

import { SettingsRow, Switch } from "@/components/ui";
import { usePreference, type Preferences } from "./preferences";

type BoolKey = { [K in keyof Preferences]: Preferences[K] extends boolean ? K : never }[keyof Preferences];

/** A settings row with a switch, saved on this device. */
export function ToggleRow({ pref, label, sublabel }: { pref: BoolKey; label: string; sublabel?: string }) {
  const [on, setOn] = usePreference(pref);
  return <SettingsRow label={label} sublabel={sublabel} control={<Switch checked={on} onChange={setOn} label={label} />} />;
}
