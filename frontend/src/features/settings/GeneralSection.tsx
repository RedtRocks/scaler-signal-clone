"use client";

import { SettingsGroup, SettingsRow } from "@/components/ui";
import { logout, useSession } from "@/store";
import { AboutSection } from "./AboutSection";

export function GeneralSection() {
  const { me } = useSession();
  return (
    <>
      <SettingsGroup footer="Log out to switch to another account, for example the reviewer accounts.">
        <SettingsRow label="Phone Number" value={me?.phone} chevron={false} />
        <SettingsRow label="Device Name" value="Web browser" chevron={false} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Log Out" destructive onClick={() => void logout()} />
      </SettingsGroup>
      <AboutSection />
    </>
  );
}
