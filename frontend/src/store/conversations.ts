import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  ConversationDetail,
  ConversationPatch,
  ConversationSettingsPatch,
  ConversationSummary,
  Id,
  MemberRole,
  Message,
  ReceiptEvent,
  UserPublic,
} from "@/lib/types";
import { useAuthStore } from "./auth";
import { applyReceiptToLast, noteMessage, refreshLastMessage, sortedIds } from "./conversationLogic";
import { usePresenceStore } from "./presence";

interface ConversationsState {
  byId: Record<Id, ConversationSummary>;
  /** Display order: pinned first, then latest activity. */
  order: Id[];
  /** Loaded on open: description and Members. */
  details: Record<Id, ConversationDetail>;
  selectedId: Id | null;
  /** True once the first loadAll has finished (so screens can tell "loading" from "no chats"). */
  loaded: boolean;

  loadAll: () => Promise<void>;
  loadDetail: (id: Id) => Promise<void>;
  upsert: (summary: ConversationSummary) => void;
  select: (id: Id | null) => void;
  noteMessage: (message: Message) => void;
  refreshLastMessage: (message: Message) => void;
  applyReceipt: (receipt: ReceiptEvent) => void;
  clearUnread: (id: Id) => void;
  markLeft: (id: Id) => void;

  /** Get-or-create the Direct Conversation with a User; returns its id. */
  openDirect: (userId: Id) => Promise<Id>;
  createGroup: (name: string, memberIds: Id[]) => Promise<Id>;
  /** Name, description, avatar or Disappearing timer. */
  update: (id: Id, patch: ConversationPatch) => Promise<void>;
  /** My own muted / pinned / archived flags. */
  updateSettings: (id: Id, patch: ConversationSettingsPatch) => Promise<void>;
  addMembers: (id: Id, userIds: Id[]) => Promise<void>;
  removeMember: (id: Id, userId: Id) => Promise<void>;
  setRole: (id: Id, userId: Id, role: MemberRole) => Promise<void>;
  leave: (id: Id) => Promise<void>;
  reset: () => void;
}

const peersOf = (summaries: ConversationSummary[]) =>
  summaries.flatMap((summary) => (summary.peer ? [summary.peer] : []));

const rememberUsers = (users: UserPublic[]) => usePresenceStore.getState().remember(users);

type ListState = Pick<ConversationsState, "byId" | "details" | "order">;

/** Stores a summary, refreshes the loaded detail it is part of, and re-sorts. */
function withSummary(state: ListState, summary: ConversationSummary): ListState {
  const byId = { ...state.byId, [summary.id]: summary };
  const detail = state.details[summary.id];
  const details = detail ? { ...state.details, [summary.id]: { ...detail, ...summary } } : state.details;
  return { byId, details, order: sortedIds(byId) };
}

export const useConversationStore = create<ConversationsState>()((set, get) => {
  /** Applies `change` to one known summary; a no-op change keeps the state as is. */
  const patchSummary = (id: Id, change: (summary: ConversationSummary) => ConversationSummary) =>
    set((state) => {
      const current = state.byId[id];
      const next = current && change(current);
      return next && next !== current ? withSummary(state, next) : state;
    });

  const setDetail = (detail: ConversationDetail) => {
    rememberUsers(detail.members.map((member) => member.user));
    set((state) => {
      const next = withSummary(state, detail);
      return { ...next, details: { ...next.details, [detail.id]: detail } };
    });
  };

  return {
    byId: {},
    order: [],
    details: {},
    selectedId: null,
    loaded: false,

    loadAll: async () => {
      const summaries = await api.listConversations();
      rememberUsers(peersOf(summaries));
      const byId = Object.fromEntries(summaries.map((summary) => [summary.id, summary]));
      set({ byId, order: sortedIds(byId), loaded: true });
    },

    loadDetail: async (id) => setDetail(await api.getConversation(id)),

    upsert: (summary) => {
      rememberUsers(peersOf([summary]));
      set((state) => withSummary(state, summary));
    },

    select: (id) => set({ selectedId: id }),

    noteMessage: (message) => {
      const meId = useAuthStore.getState().me?.id;
      if (meId !== undefined) patchSummary(message.conversation_id, (s) => noteMessage(s, message, meId));
    },

    refreshLastMessage: (message) => patchSummary(message.conversation_id, (s) => refreshLastMessage(s, message)),

    applyReceipt: (receipt) => patchSummary(receipt.conversation_id, (s) => applyReceiptToLast(s, receipt)),

    clearUnread: (id) => patchSummary(id, (s) => (s.unread_count === 0 ? s : { ...s, unread_count: 0 })),

    markLeft: (id) => patchSummary(id, (s) => (s.left ? s : { ...s, left: true })),

    openDirect: async (userId) => {
      const summary = await api.openDirect(userId);
      get().upsert(summary);
      return summary.id;
    },

    createGroup: async (name, memberIds) => {
      const summary = await api.createGroup(name, memberIds);
      get().upsert(summary);
      return summary.id;
    },

    update: async (id, patch) => get().upsert(await api.updateConversation(id, patch)),

    updateSettings: async (id, patch) => {
      patchSummary(id, (s) => ({ ...s, ...patch })); // A pin or mute toggle should feel instant.
      try {
        get().upsert(await api.updateConversationSettings(id, patch));
      } catch (error) {
        await get().loadAll(); // Undo the optimistic flags.
        throw error;
      }
    },

    addMembers: async (id, userIds) => setDetail(await api.addMembers(id, userIds)),

    removeMember: async (id, userId) => {
      await api.removeMember(id, userId);
      await get().loadDetail(id);
    },

    setRole: async (id, userId, role) => {
      await api.setMemberRole(id, userId, role);
      await get().loadDetail(id);
    },

    leave: async (id) => {
      const meId = useAuthStore.getState().me?.id;
      if (meId === undefined) return;
      await api.removeMember(id, meId);
      get().markLeft(id);
    },

    reset: () => set({ byId: {}, order: [], details: {}, selectedId: null, loaded: false }),
  };
});
