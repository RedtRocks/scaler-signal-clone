// The store's public surface for screens.
export { bootstrap, endSession, logout, socket } from "./session";
export { closeConversation, notifyTyping, openConversation, sendMessage, stopTyping } from "./chat";
export { needsProfile, useAuthStore, type ProfileInput, type SessionStatus } from "./auth";
export { useConversationStore } from "./conversations";
export { useMessageStore, type Thread } from "./messages";
export { useContactStore } from "./contacts";
export { usePresenceStore, type Presence } from "./presence";
export { useSearchStore } from "./search";
export { useToastStore, type Toast, type ToastAction } from "./toasts";
export type { ConversationFilter } from "./conversationLogic";
export * from "./hooks";
