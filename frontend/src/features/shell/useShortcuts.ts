"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useDialogStore } from "@/features/dialogs/dialogStore";
import { useConversationList } from "@/store";
import { isTypingTarget, matchShortcut, neighbourId } from "./shortcuts";

/** Dispatched on window; the Sidebar focuses its search box when it hears it. */
export const FOCUS_SEARCH_EVENT = "signal:focus-search";

function openChatId(pathname: string): number | null {
  const match = /^\/c\/(\d+)/.exec(pathname);
  return match ? Number(match[1]) : null;
}

/** Window-level keyboard shortcuts for the signed-in app. */
export function useShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const showDialog = useDialogStore((s) => s.show);
  const dialogOpen = useDialogStore((s) => s.open !== null);
  const list = useConversationList("inbox");

  // The handler is registered once; it reads the latest values through this ref.
  const latest = useRef({ pathname, dialogOpen, ids: [] as number[] });
  useEffect(() => {
    latest.current = { pathname, dialogOpen, ids: list.map((c) => c.id) };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const action = matchShortcut(e);
      if (!action) return;
      const { pathname: path, dialogOpen: modal, ids } = latest.current;
      const typing = isTypingTarget(e.target);
      const overlay = modal || document.querySelector('[role="dialog"], [role="menu"]') !== null;

      switch (action) {
        case "search":
          e.preventDefault();
          router.push("/");
          window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
          return;
        case "newChat":
        case "newGroup":
          e.preventDefault();
          showDialog(action);
          return;
        case "settings":
          e.preventDefault();
          router.push("/settings");
          return;
        case "prevChat":
        case "nextChat": {
          const next = neighbourId(ids, openChatId(path), action === "nextChat" ? 1 : -1);
          if (next === null) return;
          e.preventDefault();
          router.push(`/c/${next}`);
          return;
        }
        case "closeChat":
          // Escape belongs to dialogs, menus and text fields first.
          if (overlay || typing || path === "/") return;
          e.preventDefault();
          router.push("/");
          return;
        case "help":
          if (overlay || typing) return;
          e.preventDefault();
          showDialog("shortcuts");
          return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, showDialog]);
}
