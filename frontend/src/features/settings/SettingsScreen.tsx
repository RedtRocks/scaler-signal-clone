"use client";

/** Settings pane; `section` is the optional path segment after /settings. Owned by the settings worker. */
export function SettingsScreen({ section }: { section?: string }) {
  return <div>Settings {section ?? ""} (stub)</div>;
}
