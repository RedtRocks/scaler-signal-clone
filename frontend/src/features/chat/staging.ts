// Files picked, pasted or dropped for a conversation but not sent yet.
import { create } from "zustand";
import { acceptFiles, isImageType, contentTypeOf } from "@/lib/attachments";
import type { Id } from "@/lib/types";
import { useToastStore } from "@/store";

export interface StagedFile {
  id: string;
  file: File;
  /** blob: url for images, so the strip can show a thumbnail. */
  previewUrl: string | null;
}

interface StagingState {
  byConversation: Record<Id, StagedFile[]>;
  /** Validates and stages files; tells the user what was refused and why. */
  add: (conversationId: Id, files: File[]) => void;
  remove: (conversationId: Id, stagedId: string) => void;
  /** Hands the files over for sending and forgets them. */
  take: (conversationId: Id) => File[];
}

const NONE: StagedFile[] = [];
let counter = 0;

export const useStagingStore = create<StagingState>()((set, get) => ({
  byConversation: {},

  add: (conversationId, files) => {
    const current = get().byConversation[conversationId] ?? NONE;
    const { accepted, problems } = acceptFiles(files, current.length);
    if (problems.length > 0) useToastStore.getState().push(problems[0]);
    if (accepted.length === 0) return;
    const staged = accepted.map((file) => ({
      id: `staged-${++counter}`,
      file,
      previewUrl: isImageType(contentTypeOf(file) ?? "") ? URL.createObjectURL(file) : null,
    }));
    set((state) => ({ byConversation: { ...state.byConversation, [conversationId]: [...current, ...staged] } }));
  },

  remove: (conversationId, stagedId) => {
    const current = get().byConversation[conversationId] ?? NONE;
    const removed = current.find((item) => item.id === stagedId);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    set((state) => ({
      byConversation: { ...state.byConversation, [conversationId]: current.filter((item) => item.id !== stagedId) },
    }));
  },

  take: (conversationId) => {
    const current = get().byConversation[conversationId] ?? NONE;
    current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    set((state) => ({ byConversation: { ...state.byConversation, [conversationId]: NONE } }));
    return current.map((item) => item.file);
  },
}));

export const useStaged = (conversationId: Id): StagedFile[] =>
  useStagingStore((state) => state.byConversation[conversationId] ?? NONE);
