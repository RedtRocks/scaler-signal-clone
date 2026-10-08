import { create } from "zustand";
import type { Message } from "@/lib/types";

export type DialogName = "newChat" | "newGroup" | "contacts" | "shortcuts" | "forward";

interface DialogState {
  open: DialogName | null;
  /** The message being forwarded while the forward dialog is open. */
  forwarding: Message | null;
  show: (dialog: DialogName) => void;
  forward: (message: Message) => void;
  close: () => void;
}

/** Which app-wide dialog is open. One at a time; opening another replaces it. */
export const useDialogStore = create<DialogState>()((set) => ({
  open: null,
  forwarding: null,
  show: (open) => set({ open }),
  forward: (message) => set({ open: "forward", forwarding: message }),
  close: () => set({ open: null, forwarding: null }),
}));
