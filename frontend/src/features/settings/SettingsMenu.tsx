"use client";

import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Icon, type IconName } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { logout, useSession } from "@/store";
import styles from "./SettingsMenu.module.css";

const TOP: { id: string; label: string; icon: IconName }[] = [{ id: "donate", label: "Donate to Signal", icon: "heart" }];
const MAIN: { id: string; label: string; icon: IconName }[] = [
  { id: "appearance", label: "Appearance", icon: "chat-color" },
  { id: "chats", label: "Chats", icon: "tab-chats" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "privacy", label: "Privacy", icon: "safety-number" },
  { id: "linked-devices", label: "Linked Devices", icon: "laptop" },
  { id: "help", label: "Help", icon: "help" },
  { id: "about", label: "About", icon: "info" },
];

/** Signal Desktop's settings menu. Replaces the chat list column while Settings is open (900px and up). */
export function SettingsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useSession();
  // /settings alone shows the profile in the pane, so Profile is the active entry.
  const active = pathname.split("/")[2] ?? "profile";
  if (!me) return null;

  const item = (id: string, label: string, icon: IconName) => (
    <li key={id}>
      <button type="button" className={clsx(styles.item, active === id && styles.active)} onClick={() => router.push(`/settings/${id}`)}>
        <Icon name={icon} size={20} />
        {label}
      </button>
    </li>
  );

  return (
    <nav className={styles.menu} aria-label="Settings">
      <h2 className={styles.title}>Settings</h2>
      <button type="button" className={clsx(styles.profile, active === "profile" && styles.active)} onClick={() => router.push("/settings/profile")}>
        <Avatar name={me.display_name || me.phone} src={mediaUrl(me.avatar_url) ?? undefined} size={48} />
        <span className={styles.who}>
          <span className={styles.name}>{me.display_name}</span>
          <span className={styles.phone}>{me.phone}</span>
        </span>
      </button>
      <ul className={styles.list}>{TOP.map((i) => item(i.id, i.label, i.icon))}</ul>
      <ul className={styles.list}>{MAIN.map((i) => item(i.id, i.label, i.icon))}</ul>
      <ul className={styles.list}>
        <li>
          <button type="button" className={clsx(styles.item, styles.danger)} onClick={() => void logout()}>
            <Icon name="leave-group" size={20} />
            Log Out
          </button>
        </li>
      </ul>
    </nav>
  );
}
