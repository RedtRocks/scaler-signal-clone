"use client";

import { SettingsGroup, SettingsRow } from "@/components/ui";
import { logout, useSession } from "@/store";

export function AccountSection() {
  const { me } = useSession();
  return (
    <>
      <SettingsGroup>
        <SettingsRow label="Phone number" value={me?.phone} chevron={false} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Log Out" destructive onClick={() => void logout()} />
      </SettingsGroup>
    </>
  );
}
