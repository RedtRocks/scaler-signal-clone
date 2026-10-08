// Which images the lightbox is showing (shared by every message bubble).
import { create } from "zustand";
import type { Attachment } from "@/lib/types";

interface LightboxState {
  items: Attachment[];
  index: number;
  open: (items: Attachment[], index: number) => void;
  setIndex: (index: number) => void;
  close: () => void;
}

export const useLightboxStore = create<LightboxState>()((set) => ({
  items: [],
  index: 0,
  open: (items, index) => set({ items, index }),
  setIndex: (index) => set({ index }),
  close: () => set({ items: [], index: 0 }),
}));
