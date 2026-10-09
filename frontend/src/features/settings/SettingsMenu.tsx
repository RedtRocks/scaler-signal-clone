"use client";

import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Icon, type IconName } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { useSession } from "@/store";
import styles from "./SettingsMenu.module.css";

const TOP: { id: string; label: string; icon: IconName }[] = [
  { id: "account", label: "Account", icon: "account" },
  { id: "donate", label: "Donate to Signal", icon: "heart" },
];
const MAIN: { id: string; label: string; icon: IconName }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "appearance", label: "Appearance", icon: "appearance" },
  { id: "chats", label: "Chats", icon: "chat-outline" },
  { id: "calls", label: "Calls", icon: "phone" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "privacy", label: "Privacy", icon: "lock" },
  { id: "data-usage", label: "Data usage", icon: "data-usage" },
  { id: "backups", label: "Backups", icon: "backups" },
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
        <Icon name={icon} size={22} />
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
    </nav>
  );
}
