"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, NavRail, TabBar, ToastViewport, type NavRailId } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { DialogHost } from "@/features/dialogs/DialogHost";
import { useShortcuts } from "./useShortcuts";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { useAuthStore, useConversationStore, useToastStore } from "@/store";

function sectionOf(pathname: string): NavRailId | "settings" {
  if (pathname.startsWith("/calls")) return "calls";
  if (pathname.startsWith("/stories")) return "stories";
  if (pathname.startsWith("/settings")) return "settings";
  return "chats";
}

/** Rail + list + pane for every signed-in route. `children` is the pane. */
export function AppFrame({ children }: { children: ReactNode }) {
  useShortcuts();
  const router = useRouter();
  const pathname = usePathname();
  const me = useAuthStore((s) => s.me);
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const unread = useConversationStore((s) => Object.values(s.byId).reduce((n, c) => n + (c.unread_count ?? 0), 0));
  const section = sectionOf(pathname);
  const go = (id: NavRailId) => router.push(id === "chats" ? "/" : `/${id}`);

  return (
    <>
      <AppShell
        rail={
          <NavRail
            active={section === "settings" ? undefined : section}
            badges={{ chats: unread }}
            selfName={me?.display_name}
            selfAvatar={mediaUrl(me?.avatar_url ?? null) ?? undefined}
            onSelect={go}
            onSettings={() => router.push("/settings")}
            onProfile={() => router.push("/settings/profile")}
            settingsActive={section === "settings"}
          />
        }
        list={<Sidebar />}
        pane={children}
        tabBar={
          <TabBar
            active={section === "settings" ? "settings" : section}
            badges={{ chats: unread }}
            onSelect={(id) => router.push(id === "chats" ? "/" : `/${id}`)}
          />
        }
        mobileView={pathname === "/" ? "list" : "pane"}
      />
      <ToastViewport
        toast={toast && { id: toast.id, message: toast.message, action: toast.action?.label, onAction: toast.action?.run }}
        onDismiss={dismiss}
      />
      <DialogHost />
    </>
  );
}
