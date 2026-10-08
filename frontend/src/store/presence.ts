import { create } from "zustand";
import type { Id, IsoTime, PresenceEvent, UserPublic } from "@/lib/types";

/** A typing signal lapses if no refresh arrives (senders refresh every 3 s). */
const TYPING_EXPIRY_MS = 5_000;

export interface Presence {
  online: boolean;
  last_seen_at: IsoTime | null;
}

interface PresenceState {
  byUserId: Record<Id, Presence>;
  /** Conversation id → ids of Members typing there now. */
  typing: Record<Id, Id[]>;
  /** Takes presence from any UserPublic payload (peers, members, contacts). */
  remember: (users: UserPublic[]) => void;
  applyPresence: (event: PresenceEvent) => void;
  setTyping: (conversationId: Id, userId: Id, isTyping: boolean) => void;
  reset: () => void;
}

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function without(ids: Id[] | undefined, userId: Id): Id[] {
  return (ids ?? []).filter((id) => id !== userId);
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  byUserId: {},
  typing: {},

  remember: (users) =>
    set((state) => {
      const byUserId = { ...state.byUserId };
      for (const { id, online, last_seen_at } of users) byUserId[id] = { online, last_seen_at };
      return { byUserId };
    }),

  applyPresence: ({ user_id, online, last_seen_at }) =>
    set((state) => ({ byUserId: { ...state.byUserId, [user_id]: { online, last_seen_at } } })),

  setTyping: (conversationId, userId, isTyping) => {
    const key = `${conversationId}:${userId}`;
    clearTimeout(expiryTimers.get(key));
    expiryTimers.delete(key);
    if (isTyping) {
      expiryTimers.set(key, setTimeout(() => get().setTyping(conversationId, userId, false), TYPING_EXPIRY_MS));
    }
    set((state) => {
      const current = state.typing[conversationId];
      if ((current?.includes(userId) ?? false) === isTyping) return state; // nothing changes
      const others = without(current, userId);
      return { typing: { ...state.typing, [conversationId]: isTyping ? [...others, userId] : others } };
    });
  },

  reset: () => {
    expiryTimers.forEach(clearTimeout);
    expiryTimers.clear();
    set({ byUserId: {}, typing: {} });
  },
}));
