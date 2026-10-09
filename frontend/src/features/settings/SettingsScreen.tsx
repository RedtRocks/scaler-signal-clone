"use client";

import { useRouter } from "next/navigation";
import { Button, ComingSoon, Spinner, type IconName } from "@/components/ui";
import { useSession } from "@/store";
import { AboutSection } from "./AboutSection";
import { AccountSection } from "./AccountSection";
import { CallsSection } from "./CallsSection";
import { DataUsageSection } from "./DataUsageSection";
import { GeneralSection } from "./GeneralSection";
import { AppearanceSection } from "./AppearanceSection";
import { ChatsSection } from "./ChatsSection";
import { NotificationsSection } from "./NotificationsSection";
import { PrivacySection } from "./PrivacySection";
import { ProfileSection } from "./ProfileSection";
import { SettingsIndex } from "./SettingsIndex";
import styles from "./SettingsScreen.module.css";

const TITLES: Record<string, string> = {
  account: "Account",
  general: "General",
  calls: "Calls",
  "data-usage": "Data usage",
  backups: "Backups",
  profile: "Profile",
  appearance: "Appearance",
  chats: "Chats",
  privacy: "Privacy",
  notifications: "Notifications",
  "linked-devices": "Linked Devices",
  help: "Help",
  donate: "Donate",
  about: "About",
};

const SOON: Record<string, { icon: IconName; text: string }> = {
  backups: { icon: "backups", text: "Backups are not available in this build yet." },
  "linked-devices": { icon: "contact", text: "Linked devices are not available in this build yet." },
  help: { icon: "requests", text: "Help and support are not available in this build yet." },
  donate: { icon: "sounds", text: "Donations are not available in this build yet." },
};

function Body({ section }: { section: string }) {
  switch (section) {
    case "profile":
      return <ProfileSection />;
    case "appearance":
      return <AppearanceSection />;
    case "chats":
      return <ChatsSection />;
    case "privacy":
      return <PrivacySection />;
    case "notifications":
      return <NotificationsSection />;
    case "about":
      return <AboutSection />;
    case "general":
      return <GeneralSection />;
    case "calls":
      return <CallsSection />;
    case "data-usage":
      return <DataUsageSection />;
    case "account":
      return <AccountSection />;
    default: {
      const soon = SOON[section];
      return (
        <div className={styles.center}>
          <ComingSoon icon={soon.icon}>
            {soon.text}
          </ComingSoon>
        </div>
      );
    }
  }
}

/** Settings pane; `section` is the optional path segment after /settings. */
export function SettingsScreen({ section }: { section?: string }) {
  const router = useRouter();
  const { me } = useSession();
  const known = section !== undefined && section in TITLES;
  const title = known ? TITLES[section] : "Settings";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* On the index, Back is only needed on phones, where Settings replaces the chat list. */}
        <Button
          variant="icon"
          icon="back"
          className={known ? `${styles.back} ${styles.wideHidden}` : `${styles.back} ${styles.phoneOnly}`}
          aria-label="Back"
          onClick={() => router.push(known ? "/settings" : "/")}
        />
        {known ? (
          <h1 className={styles.title}>{title}</h1>
        ) : (
          <h1 className={styles.title}>
            <span className={styles.narrowOnly}>Settings</span>
            <span className={styles.wideOnly}>Profile</span>
          </h1>
        )}
      </header>
      <div className={styles.scroll}>
        <div className={styles.content}>
          {!me ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : known ? (
            <Body section={section} />
          ) : (
            <>
              <div className={styles.narrowOnly}>
                <SettingsIndex />
              </div>
              <div className={styles.wideOnly}>
                <ProfileSection />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
