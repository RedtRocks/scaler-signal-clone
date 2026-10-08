"use client";

import { useRouter } from "next/navigation";
import { ProfileHeader, SettingsGroup, SettingsRow } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { logout, useSession } from "@/store";

export function SettingsIndex() {
  const router = useRouter();
  const { me } = useSession();
  if (!me) return null;
  const go = (section: string) => () => router.push(`/settings/${section}`);

  return (
    <>
      <ProfileHeader
        name={me.display_name}
        subtitle={me.phone}
        avatarSrc={mediaUrl(me.avatar_url) ?? undefined}
        size={96}
      />
      <SettingsGroup>
        <SettingsRow label="Profile" sublabel={me.about || "Name, about and photo"} icon="contact" onClick={go("profile")} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Appearance" icon="chat-color" onClick={go("appearance")} />
        <SettingsRow label="Chats" icon="tab-chats" onClick={go("chats")} />
        <SettingsRow label="Notifications" icon="sounds" onClick={go("notifications")} />
        <SettingsRow label="Privacy" icon="safety-number" onClick={go("privacy")} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Linked Devices" icon="phone" value="Coming soon" onClick={go("linked-devices")} />
        <SettingsRow label="Help" icon="requests" value="Coming soon" onClick={go("help")} />
        <SettingsRow label="Donate to Signal" icon="verified" value="Coming soon" onClick={go("donate")} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="About" icon="permissions" onClick={go("about")} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Log Out" destructive onClick={() => void logout()} />
      </SettingsGroup>
    </>
  );
}
