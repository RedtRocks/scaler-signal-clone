"use client";

import clsx from "clsx";
import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./AppShell.module.css";

export const PHONE_QUERY = "(max-width: 599px)";

/** true below 600px (phone layout). false during SSR. */
export function useIsPhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

export interface AppShellProps {
  /** Desktop NavRail (hidden on phones). */
  rail?: ReactNode;
  /** Conversation list column (ChatListHeader, SearchField, rows…). */
  list: ReactNode;
  /** Chat pane (ChatHeader + timeline + Composer), EmptyChatPane or ComingSoon. */
  pane: ReactNode;
  /** Phone TabBar, shown under the list view only. */
  tabBar?: ReactNode;
  /** Phone only: which single column is visible. Desktop always shows all three. */
  mobileView?: "list" | "pane";
  /** Phone only: also show the TabBar under the pane (Calls, Stories), so the user can switch tabs back. */
  tabBarInPane?: boolean;
  /** Force phone layout at any width (adds .sg-mobile). For previews. */
  forceMobile?: boolean;
  className?: string;
}

/** Desktop: rail 68 | list 320 | pane. Phone (<600px): list+TabBar or pane, switched by `mobileView`. */
export function AppShell({ rail, list, pane, tabBar, mobileView = "list", tabBarInPane, forceMobile, className }: AppShellProps) {
  return (
    <div className={clsx(styles.shell, forceMobile && "sg-mobile", className)} data-view={mobileView}>
      {rail ? <div className={styles.rail}>{rail}</div> : null}
      <section className={styles.list} aria-label="Conversations">
        <div className={styles.listBody}>{list}</div>
        {tabBar ? <div className={styles.tabBar}>{tabBar}</div> : null}
      </section>
      <main className={styles.pane}>
        {pane}
        {tabBarInPane && tabBar ? <div className={styles.paneTabBar}>{tabBar}</div> : null}
      </main>
    </div>
  );
}
