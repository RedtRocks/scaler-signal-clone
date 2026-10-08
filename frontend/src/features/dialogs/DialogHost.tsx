"use client";

import { ContactsDialog } from "./ContactsDialog";
import { useDialogStore } from "./dialogStore";
import { NewChatDialog } from "./NewChatDialog";
import { NewGroupDialog } from "./NewGroupDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";

/** Renders whichever app-wide dialog is open (new chat, new group, contacts). */
export function DialogHost() {
  const open = useDialogStore((s) => s.open);
  switch (open) {
    case "newChat":
      return <NewChatDialog />;
    case "newGroup":
      return <NewGroupDialog />;
    case "contacts":
      return <ContactsDialog />;
    case "shortcuts":
      return <ShortcutsDialog />;
    default:
      return null;
  }
}
