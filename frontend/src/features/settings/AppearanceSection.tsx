"use client";

import { RadioGroup, SettingsGroup, useThemePreference, type ThemePreference } from "@/components/ui";
import styles from "./SettingsScreen.module.css";

export function AppearanceSection() {
  const [theme, setTheme] = useThemePreference();
  return (
    <SettingsGroup footer="System follows your device’s light or dark setting. The color of each chat is set from that chat’s settings. This choice is saved on this device.">
      <div className={styles.radios}>
        <RadioGroup<ThemePreference>
          label="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </div>
    </SettingsGroup>
  );
}
