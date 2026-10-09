"use client";

import { SettingsGroup, SettingsRow } from "@/components/ui";
import { ToggleRow } from "./Rows";
import styles from "./SettingsScreen.module.css";

export function PrivacySection() {
  return (
    <>
      <SettingsGroup title="Messaging" footer="When typing indicators are off, the other person does not see that you are typing. Saved on this device.">
        <ToggleRow pref="typingIndicators" label="Typing indicators" />
      </SettingsGroup>
      <SettingsGroup
        title="Disappearing Messages"
        footer="The timer is set for each chat, from the chat’s details. New messages in that chat disappear for everyone once it runs out."
      >
        <SettingsRow label="Default timer" icon="disappearing" value="Per chat" chevron={false} />
      </SettingsGroup>
      <SettingsGroup title="Encryption">
        <p className={styles.hint}>
          Signal clone shows end-to-end encryption and safety numbers as interface text only. Messages are stored as
          plain text on the server of this demo.
        </p>
      </SettingsGroup>
    </>
  );
}
