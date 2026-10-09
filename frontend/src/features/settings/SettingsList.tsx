"use client";

import { Sidebar } from "@/features/sidebar/Sidebar";
import { SettingsMenu } from "./SettingsMenu";
import styles from "./SettingsMenu.module.css";

/** List column while Settings is open: the settings menu from 900px up, the usual list (avatar strip) below. */
export function SettingsList() {
  return (
    <>
      <div className={styles.narrowOnly}>
        <Sidebar />
      </div>
      <div className={styles.wideOnly}>
        <SettingsMenu />
      </div>
    </>
  );
}
