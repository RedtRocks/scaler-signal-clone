import { create } from "zustand";
import type { ConversationSummary, Id } from "@/lib/types";
import { demoHistory, participantsOf, type CallKind, type CallRecord, type Participant } from "@/lib/calls";
import { useAuthStore } from "./auth";
import { useConversationStore } from "./conversations";

export interface ActiveCall {
  conversationId: Id;
  title: string;
  avatarUrl: string | null;
  isGroup: boolean;
  kind: CallKind;
  /** Everyone invited. */
  participants: Participant[];
  /** Ids that picked up so far (the call is simulated: people join one after another). */
  joined: Id[];
  phase: "ringing" | "connected";
  /** Date.now() when the call connected. */
  connectedAt: number | null;
  startedIso: string;
}

interface CallState {
  active: ActiveCall | null;
  history: CallRecord[];
  historyLoaded: boolean;
  /** Starts a (simulated) call in a conversation; loads the member list first for groups. */
  start: (conversationId: Id, kind: CallKind) => Promise<void>;
  connect: () => void;
  join: (userId: Id) => void;
  /** Hangs up and records the call in the history. */
  end: () => void;
  loadHistory: (meId: Id, conversations: readonly ConversationSummary[]) => void;
  clearHistory: (meId: Id) => void;
  reset: () => void;
}

const key = (meId: Id) => `signal-calls:${meId}`;

function readHistory(meId: Id): CallRecord[] | null {
  try {
    const raw = localStorage.getItem(key(meId));
    return raw ? (JSON.parse(raw) as CallRecord[]) : null;
  } catch {
    return null;
  }
}
function writeHistory(meId: Id, history: CallRecord[]) {
  try {
    localStorage.setItem(key(meId), JSON.stringify(history.slice(0, 100)));
  } catch {
    // Storage blocked: the history just lives for this visit.
  }
}

export const useCallStore = create<CallState>()((set, get) => ({
  active: null,
  history: [],
  historyLoaded: false,

  start: async (conversationId, kind) => {
    if (get().active) return;
    const conversations = useConversationStore.getState();
    const conversation = conversations.byId[conversationId];
    if (!conversation) return;
    if (conversation.kind === "group" && !conversations.details[conversationId]) {
      await conversations.loadDetail(conversationId);
    }
    if (get().active) return;
    const detail = useConversationStore.getState().details[conversationId];
    const meId = useAuthStore.getState().me?.id;
    const participants = participantsOf(conversation, detail?.members, meId);
    set({
      active: {
        conversationId,
        title: conversation.title,
        avatarUrl: conversation.avatar_url ?? conversation.peer?.avatar_url ?? null,
        isGroup: conversation.kind === "group",
        kind,
        participants,
        joined: [],
        phase: "ringing",
        connectedAt: null,
        startedIso: new Date().toISOString(),
      },
    });
  },

  connect: () =>
    set((state) => (state.active && state.active.phase === "ringing" ? { active: { ...state.active, phase: "connected", connectedAt: Date.now() } } : state)),

  join: (userId) =>
    set((state) =>
      state.active && !state.active.joined.includes(userId)
        ? { active: { ...state.active, joined: [...state.active.joined, userId] } }
        : state,
    ),

  end: () => {
    const call = get().active;
    if (!call) return;
    const meId = useAuthStore.getState().me?.id;
    const connected = call.connectedAt !== null;
    const record: CallRecord = {
      id: `call-${Date.now()}`,
      conversationId: call.conversationId,
      title: call.title,
      avatarUrl: call.avatarUrl,
      isGroup: call.isGroup,
      kind: call.kind,
      direction: "outgoing",
      at: call.startedIso,
      seconds: connected ? Math.round((Date.now() - call.connectedAt!) / 1000) : undefined,
    };
    const history = [record, ...get().history];
    if (meId !== undefined) writeHistory(meId, history);
    set({ active: null, history });
  },

  loadHistory: (meId, conversations) => {
    if (get().historyLoaded) return;
    const stored = readHistory(meId);
    const history = stored ?? demoHistory(conversations, new Date());
    if (!stored && history.length > 0) writeHistory(meId, history);
    set({ history, historyLoaded: true });
  },

  clearHistory: (meId) => {
    writeHistory(meId, []);
    set({ history: [] });
  },

  reset: () => set({ active: null, history: [], historyLoaded: false }),
}));
