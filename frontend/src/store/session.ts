// The composition root: owns the socket, connects the API to the auth store,
// and starts or ends a signed-in session across every store.
import { ApiError, api, configureApi } from "@/lib/api";
import { WS_URL } from "@/lib/config";
import { SignalSocket } from "@/lib/socket";
import { useAuthStore } from "./auth";
import { useContactStore } from "./contacts";
import { useConversationStore } from "./conversations";
import { useMessageStore } from "./messages";
import { usePresenceStore } from "./presence";
import { wireRealtime } from "./realtime";
import { useSearchStore } from "./search";
import { useStoryStore } from "./stories";
import { useToastStore } from "./toasts";

export const socket = new SignalSocket({ url: WS_URL, onUnauthorized: endSession });

configureApi({ getToken: () => useAuthStore.getState().token, onUnauthorized: endSession });

let unwire: (() => void) | null = null;

function connectRealtime(token: string): void {
  unwire?.();
  unwire = wireRealtime(socket);
  socket.connect(token);
}

/**
 * Call once on app load, and again after verifyOtp. Without a saved token it
 * only settles the auth status to "signedOut".
 */
export async function bootstrap(): Promise<void> {
  const token = useAuthStore.getState().restoreToken();
  if (!token) return;
  // Connect first so pushes that race the initial load are not missed.
  connectRealtime(token);
  try {
    const [me] = await Promise.all([
      api.getMe(),
      useConversationStore.getState().loadAll(),
      useContactStore.getState().load(),
    ]);
    useAuthStore.getState().setMe(me);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return; // endSession already ran.
    useToastStore.getState().push("Couldn't load your chats.", { label: "Retry", run: () => void bootstrap() });
  }
}

/** Clears every store and the saved token. Used by logout and when the server rejects the token. */
export function endSession(): void {
  unwire?.();
  unwire = null;
  socket.disconnect();
  useConversationStore.getState().reset();
  useMessageStore.getState().reset();
  useContactStore.getState().reset();
  usePresenceStore.getState().reset();
  useSearchStore.getState().reset();
  useStoryStore.getState().reset();
  useToastStore.getState().dismiss();
  useAuthStore.getState().reset();
}

/** Ends this Session on the server (best effort), then locally. */
export async function logout(): Promise<void> {
  await api.logout().catch(() => {});
  endSession();
}
