"use client";

import { useRouter } from "next/navigation";
import { Avatar, SettingsGroup, SettingsRow } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { logout, useSession } from "@/store";
import { MENU_MAIN, MENU_TOP } from "./SettingsMenu";

/** Settings list for phones and tablets. Same entries and icons as the desktop menu; the account is on top. */
export function SettingsIndex() {
  const router = useRouter();
  const { me } = useSession();
  if (!me) return null;
  const go = (section: string) => () => router.push(`/settings/${section}`);

  return (
    <>
      <SettingsGroup>
        <SettingsRow
          label={me.display_name || me.phone}
          sublabel={me.about ? `${me.phone} · ${me.about}` : me.phone}
          avatar={<Avatar name={me.display_name || me.phone} src={mediaUrl(me.avatar_url) ?? undefined} size={48} />}
          onClick={go("profile")}
        />
      </SettingsGroup>
      <SettingsGroup>
        {MENU_TOP.map((i) => (
          <SettingsRow key={i.id} label={i.label} icon={i.icon} onClick={go(i.id)} />
        ))}
      </SettingsGroup>
      <SettingsGroup>
        {MENU_MAIN.map((i) => (
          <SettingsRow key={i.id} label={i.label} icon={i.icon} onClick={go(i.id)} />
        ))}
      </SettingsGroup>
      <SettingsGroup>
        <SettingsRow label="Log Out" destructive onClick={() => void logout()} />
      </SettingsGroup>
    </>
  );
}
