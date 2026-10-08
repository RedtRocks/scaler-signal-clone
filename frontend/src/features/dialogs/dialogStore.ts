import { create } from "zustand";

export type DialogName = "newChat" | "newGroup" | "contacts" | "shortcuts";

interface DialogState {
  open: DialogName | null;
  show: (dialog: DialogName) => void;
  close: () => void;
}

/** Which app-wide dialog is open. One at a time; opening another replaces it. */
export const useDialogStore = create<DialogState>()((set) => ({
  open: null,
  show: (open) => set({ open }),
  close: () => set({ open: null }),
}));
