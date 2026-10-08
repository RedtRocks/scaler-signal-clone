"use client";

import { SettingsGroup, SettingsRow } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { useSession } from "@/store";
import styles from "./SettingsScreen.module.css";

const VERSION = "0.1.0";

export function AboutSection() {
  const { me } = useSession();
  return (
    <>
      <SettingsGroup>
        <SettingsRow label="Version" value={VERSION} chevron={false} />
        <SettingsRow label="Server" value={API_URL.replace(/^https?:\/\//, "")} chevron={false} />
      </SettingsGroup>
      <SettingsGroup title="This session">
        <SettingsRow label="Signed in as" value={me?.phone} chevron={false} />
        <SettingsRow label="Account created" value={me ? new Date(me.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : undefined} chevron={false} />
      </SettingsGroup>
      <SettingsGroup title="Legal">
        <div className={styles.legal}>
          <p>
            This is an educational clone of the Signal Messenger interface, built for a coursework assignment. It is not
            affiliated with or endorsed by Signal Messenger LLC or the Signal Foundation.
          </p>
          <p>Verification codes are mocked, and messages are not end-to-end encrypted.</p>
        </div>
      </SettingsGroup>
    </>
  );
}
