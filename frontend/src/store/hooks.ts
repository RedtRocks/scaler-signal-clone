// Read-side hooks for components. Each subscribes to the smallest slice it needs.
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import type { SocketStatus } from "@/lib/socket";
import { buildTimeline, type TimelineItem } from "@/lib/timeline";
import type { Id } from "@/lib/types";
import { needsProfile, useAuthStore } from "./auth";
import { selectConversations, type ConversationFilter } from "./conversationLogic";
import { useContactStore } from "./contacts";
import { useConversationStore } from "./conversations";
import { EMPTY_THREAD, useMessageStore } from "./messages";
import { resolveName } from "./names";
import { usePresenceStore, type Presence } from "./presence";
import { useSearchStore } from "./search";
import { socket } from "./session";

const NO_IDS: Id[] = [];

export function useSession() {
  return useAuthStore(
    useShallow((state) => ({ status: state.status, me: state.me, needsProfile: needsProfile(state.me) })),
  );
}

/** Conversation list rows for a tab, narrowed by the search query's title match. */
export function useConversationList(filter: ConversationFilter = "inbox") {
  const query = useSearchStore((state) => state.query);
  return useConversationStore(useShallow((state) => selectConversations(state.order, state.byId, filter, query)));
}

export function useConversation(id: Id | null) {
  return useConversationStore((state) => (id === null ? undefined : state.byId[id]));
}

/** Description and Members; loaded by openConversation. */
export function useConversationDetail(id: Id | null) {
  return useConversationStore((state) => (id === null ? undefined : state.details[id]));
}

/** Pagination flags for the open thread: hasMore, loading, loaded. */
export function useThreadStatus(id: Id) {
  return useMessageStore(
    useShallow((state) => {
      const { hasMore, loading, loaded } = state.threads[id] ?? EMPTY_THREAD;
      return { hasMore, loading, loaded };
    }),
  );
}

export function useTimeline(id: Id): TimelineItem[] {
  const messages = useMessageStore((state) => (state.threads[id] ?? EMPTY_THREAD).messages);
  const meId = useAuthStore((state) => state.me?.id);
  const isGroup = useConversationStore((state) => state.byId[id]?.kind === "group");
  return useMemo(() => buildTimeline(messages, meId, isGroup), [messages, meId, isGroup]);
}

/** A stable `nameOf(userId)` for one conversation, e.g. for systemEventText. */
export function useNameOf(conversationId: Id): (userId: Id) => string {
  const contacts = useContactStore((state) => state.contacts);
  const members = useConversationStore((state) => state.details[conversationId]?.members);
  const peer = useConversationStore((state) => state.byId[conversationId]?.peer);
  return useCallback((userId: Id) => resolveName(userId, { contacts, members, peer }), [contacts, members, peer]);
}

/** Names of the Members typing in a conversation right now. */
export function useTypingNames(conversationId: Id): string[] {
  const typingIds = usePresenceStore((state) => state.typing[conversationId] ?? NO_IDS);
  const nameOf = useNameOf(conversationId);
  return useMemo(() => typingIds.map(nameOf), [typingIds, nameOf]);
}

export function usePresence(userId: Id | undefined): Presence | undefined {
  return usePresenceStore((state) => (userId === undefined ? undefined : state.byUserId[userId]));
}

/** "connecting" drives the Connecting… banner. */
export function useSocketStatus(): SocketStatus {
  return useSyncExternalStore(
    socket.subscribeStatus,
    () => socket.status,
    () => "connecting",
  );
}
