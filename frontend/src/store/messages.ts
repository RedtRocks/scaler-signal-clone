import { create } from "zustand";
import { api, ApiError, uploadAttachment } from "@/lib/api";
import { contentTypeOf, isImageType, measureImage } from "@/lib/attachments";
import { newClientId } from "@/lib/clientId";
import type { Attachment, Id, Message, ReceiptEvent } from "@/lib/types";
import { useAuthStore } from "./auth";
import { useConversationStore } from "./conversations";
import { useToastStore } from "./toasts";
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
  /** client_id of a message being sent → upload progress (0..1) of each of its files. */
  uploads: Record<string, number[]>;
  loadLatest: (conversationId: Id) => Promise<void>;
  loadOlder: (conversationId: Id) => Promise<void>;
  /**
   * Optimistic send: the bubble shows at once as "sending" (with local previews of `files`),
   * then becomes the stored Message or "failed". Files upload first, then the message is posted.
   */
  send: (conversationId: Id, body: string, replyTo?: Message | null, files?: File[]) => Promise<void>;
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

/** Files of a message still being sent: kept outside the store (File isn't serialisable state). */
interface PendingSend {
  files: File[];
  /** The stored Attachment of each file once its upload finished; a retry skips those. */
  uploaded: (Attachment | null)[];
  /** blob: urls to release once the stored message has replaced the optimistic one. */
  previewUrls: string[];
}
const pendingSends = new Map<string, PendingSend>();
const RELEASE_PREVIEW_MS = 10_000;

/** A local stand-in for a file being sent: blob: preview url and, for images, its measured size. */
async function localAttachment(file: File): Promise<Attachment> {
  const url = URL.createObjectURL(file);
  const contentType = contentTypeOf(file) ?? file.type;
  const size = isImageType(contentType) ? await measureImage(url) : null;
  return {
    id: nextLocalId--,
    url,
    file_name: file.name,
    content_type: contentType,
    size: file.size,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
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

  const setProgress = (clientId: string, change: (fractions: number[]) => number[]) =>
    set((state) => ({ uploads: { ...state.uploads, [clientId]: change(state.uploads[clientId] ?? []) } }));

  /** Uploads every file that isn't stored yet, in parallel. Throws the first failure after all settle. */
  const uploadFiles = async (conversationId: Id, clientId: string, job: PendingSend) => {
    const results = await Promise.allSettled(
      job.files.map(async (file, index) => {
        if (job.uploaded[index]) return;
        const type = contentTypeOf(file) ?? file.type;
        const upload = file.type === type ? file : new File([file], file.name, { type });
        job.uploaded[index] = await uploadAttachment(conversationId, upload, (fraction) =>
          setProgress(clientId, (all) => all.map((value, i) => (i === index ? fraction : value))),
        );
        setProgress(clientId, (all) => all.map((value, i) => (i === index ? 1 : value)));
      }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw (failure as PromiseRejectedResult).reason;
  };

  const finishSend = (clientId: string) => {
    const job = pendingSends.get(clientId);
    pendingSends.delete(clientId);
    set((state) => ({
      uploads: Object.fromEntries(Object.entries(state.uploads).filter(([key]) => key !== clientId)),
    }));
    if (job) setTimeout(() => job.previewUrls.forEach((url) => URL.revokeObjectURL(url)), RELEASE_PREVIEW_MS);
  };

  /** Uploads the files, then POSTs the optimistic message; client_id makes a resend safe. */
  const deliver = async (pending: PendingMessage) => {
    const job = pendingSends.get(pending.client_id);
    try {
      if (job) await uploadFiles(pending.conversation_id, pending.client_id, job);
      const stored = await api.sendMessage(pending.conversation_id, {
        body: pending.body,
        client_id: pending.client_id,
        reply_to_id: pending.reply_to?.id,
        attachment_ids: job ? job.uploaded.map((attachment) => attachment!.id) : undefined,
      });
      get().receive(stored);
      finishSend(pending.client_id);
    } catch (error) {
      updateMessages(pending.conversation_id, (messages) => setPendingStatus(messages, pending.client_id, "failed"));
      // A file the server refuses will be refused again, so say why instead of only offering retry.
      if (error instanceof ApiError && (error.status === 400 || error.status === 413)) {
        useToastStore.getState().push(error.detail);
      }
    }
  };

  return {
    threads: {},
    uploads: {},

    loadLatest: (conversationId) => loadPage(conversationId),

    loadOlder: async (conversationId) => {
      const { hasMore, messages } = thread(conversationId);
      const beforeId = oldestStoredId(messages);
      if (hasMore && beforeId !== undefined) await loadPage(conversationId, beforeId);
    },

    send: async (conversationId, body, replyTo = null, files = []) => {
      const me = useAuthStore.getState().me;
      const text = body.trim();
      if (!me || (!text && files.length === 0)) return;
      const clientId = newClientId();
      const previews = await Promise.all(files.map(localAttachment));
      if (files.length > 0) {
        pendingSends.set(clientId, {
          files,
          uploaded: files.map(() => null),
          previewUrls: previews.map((preview) => preview.url),
        });
        set((state) => ({ uploads: { ...state.uploads, [clientId]: files.map(() => 0) } }));
      }
      const pending = createOptimisticMessage({
        localId: nextLocalId--,
        conversationId,
        senderId: me.id,
        clientId,
        body: text,
        replyTo,
        now: new Date().toISOString(),
        attachments: previews,
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

    reset: () => {
      pendingSends.forEach((job) => job.previewUrls.forEach((url) => URL.revokeObjectURL(url)));
      pendingSends.clear();
      set({ threads: {}, uploads: {} });
    },
  };
});
