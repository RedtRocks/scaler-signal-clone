import { create } from "zustand";
import { api } from "@/lib/api";
import { newClientId } from "@/lib/clientId";
import type { Id, Message, ReceiptEvent } from "@/lib/types";
import { useAuthStore } from "./auth";
import { useConversationStore } from "./conversations";
import {
  applyMessageUpdate,
  applyReceipt,
  createOptimisticMessage,
  latestIncomingId,
  isPending,
  mergePage,
  oldestStoredId,
  type PendingMessage,
  setPendingStatus,
  upsertMessage,
} from "./messageLogic";

const PAGE_SIZE = 50;

/** One Conversation's loaded history. */
export interface Thread {
  /** Oldest first. Optimistic messages (negative ids) sit at the end. */
  messages: Message[];
  /** Older pages may exist on the server. */
  hasMore: boolean;
  loading: boolean;
  /** The latest page has been fetched at least once. */
  loaded: boolean;
  /** Highest message id this client has already sent POST /read for. */
  readUpTo: Id;
}

export const EMPTY_THREAD: Thread = { messages: [], hasMore: true, loading: false, loaded: false, readUpTo: 0 };

interface MessagesState {
  threads: Record<Id, Thread>;
  loadLatest: (conversationId: Id) => Promise<void>;
  loadOlder: (conversationId: Id) => Promise<void>;
  /** Optimistic send: the bubble shows at once as "sending", then becomes the stored Message or "failed". */
  send: (conversationId: Id, body: string, replyTo?: Message | null) => Promise<void>;
  retry: (conversationId: Id, clientId: string) => Promise<void>;
  /** A stored Message from the POST response or a message.new push. Safe to call twice. */
  receive: (message: Message) => void;
  applyUpdate: (message: Message) => void;
  applyReceipt: (receipt: ReceiptEvent) => void;
  /** Moves this client's read pointer to the newest incoming message; returns it if it moved. */
  advanceReadPointer: (conversationId: Id) => Id | undefined;
  react: (messageId: Id, emoji: string) => Promise<void>;
  removeReaction: (messageId: Id) => Promise<void>;
  /** Delete for everyone; the message.updated push updates the timeline. */
  deleteForEveryone: (messageId: Id) => Promise<void>;
  reset: () => void;
}

/** Optimistic messages count down from -1 so they never collide with stored ids. */
let nextLocalId = -1;

export const useMessageStore = create<MessagesState>()((set, get) => {
  const thread = (conversationId: Id) => get().threads[conversationId] ?? EMPTY_THREAD;

  const patchThread = (conversationId: Id, change: (thread: Thread) => Partial<Thread>) =>
    set((state) => {
      const current = state.threads[conversationId] ?? EMPTY_THREAD;
      return { threads: { ...state.threads, [conversationId]: { ...current, ...change(current) } } };
    });

  const updateMessages = (conversationId: Id, change: (messages: Message[]) => Message[]) =>
    patchThread(conversationId, ({ messages }) => ({ messages: change(messages) }));

  const loadPage = async (conversationId: Id, beforeId?: Id) => {
    if (thread(conversationId).loading) return;
    patchThread(conversationId, () => ({ loading: true }));
    try {
      const page = await api.listMessages(conversationId, { beforeId, limit: PAGE_SIZE });
      patchThread(conversationId, (current) => ({
        messages: mergePage(current.messages, page),
        loaded: true,
        // A refresh of the latest page says nothing about older history.
        hasMore: beforeId === undefined && current.loaded ? current.hasMore : page.length === PAGE_SIZE,
      }));
    } finally {
      patchThread(conversationId, () => ({ loading: false }));
    }
  };

  /** POSTs an optimistic message; client_id makes a resend safe. */
  const deliver = async (pending: PendingMessage) => {
    try {
      const stored = await api.sendMessage(pending.conversation_id, {
        body: pending.body,
        client_id: pending.client_id,
        reply_to_id: pending.reply_to?.id,
      });
      get().receive(stored);
    } catch {
      updateMessages(pending.conversation_id, (messages) => setPendingStatus(messages, pending.client_id, "failed"));
    }
  };

  return {
    threads: {},

    loadLatest: (conversationId) => loadPage(conversationId),

    loadOlder: async (conversationId) => {
      const { hasMore, messages } = thread(conversationId);
      const beforeId = oldestStoredId(messages);
      if (hasMore && beforeId !== undefined) await loadPage(conversationId, beforeId);
    },

    send: async (conversationId, body, replyTo = null) => {
      const me = useAuthStore.getState().me;
      const text = body.trim();
      if (!me || !text) return;
      const pending = createOptimisticMessage({
        localId: nextLocalId--,
        conversationId,
        senderId: me.id,
        clientId: newClientId(),
        body: text,
        replyTo,
        now: new Date().toISOString(),
      });
      updateMessages(conversationId, (messages) => upsertMessage(messages, pending));
      useConversationStore.getState().noteMessage(pending);
      await deliver(pending);
    },

    retry: async (conversationId, clientId) => {
      const failed = thread(conversationId)
        .messages.filter(isPending)
        .find((message) => message.client_id === clientId && message.status === "failed");
      if (!failed) return;
      updateMessages(conversationId, (messages) => setPendingStatus(messages, clientId, "sending"));
      await deliver(failed);
    },

    receive: (message) => {
      updateMessages(message.conversation_id, (messages) => upsertMessage(messages, message));
      useConversationStore.getState().noteMessage(message);
    },

    applyUpdate: (message) => {
      updateMessages(message.conversation_id, (messages) => applyMessageUpdate(messages, message));
      useConversationStore.getState().refreshLastMessage(message);
    },

    applyReceipt: (receipt) => {
      updateMessages(receipt.conversation_id, (messages) =>
        applyReceipt(messages, receipt.message_ids, receipt.status),
      );
      useConversationStore.getState().applyReceipt(receipt);
    },

    advanceReadPointer: (conversationId) => {
      const meId = useAuthStore.getState().me?.id;
      const current = thread(conversationId);
      const latest = meId === undefined ? undefined : latestIncomingId(current.messages, meId);
      if (latest === undefined || latest <= current.readUpTo) return undefined;
      patchThread(conversationId, () => ({ readUpTo: latest }));
      return latest;
    },

    react: (messageId, emoji) => api.setReaction(messageId, emoji),

    removeReaction: (messageId) => api.removeReaction(messageId),

    deleteForEveryone: (messageId) => api.deleteMessage(messageId),

    reset: () => set({ threads: {} }),
  };
});
