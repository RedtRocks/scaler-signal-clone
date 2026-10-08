import { create } from "zustand";

const TOAST_MS = 4_000;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  /** Changes on every push, so the UI can replay its entrance for a repeated message. */
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastState {
  toast: Toast | null;
  /** Shows one toast at a time; a new one replaces the current one. */
  push: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}

let nextId = 1;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>()((set) => ({
  toast: null,

  push: (message, action) => {
    clearTimeout(hideTimer);
    set({ toast: { id: nextId++, message, action } });
    hideTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },

  dismiss: () => {
    clearTimeout(hideTimer);
    set({ toast: null });
  },
}));
