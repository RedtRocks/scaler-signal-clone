import { create } from "zustand";
import { api } from "@/lib/api";
import type { Me, RequestOtpResponse } from "@/lib/types";

const TOKEN_KEY = "signal.token";

// Storage access can throw (private mode, blocked site data), so it never fails the flow.
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The session still works for this tab.
  }
}

/** "unknown" until the stored token has been read on the client. */
export type SessionStatus = "unknown" | "signedOut" | "signedIn";

export interface ProfileInput {
  displayName: string;
  about?: string;
  avatar?: Blob;
}

interface AuthState {
  status: SessionStatus;
  token: string | null;
  me: Me | null;
  /** Reads the saved token (client only) and returns it. */
  restoreToken: () => string | null;
  requestOtp: (phone: string) => Promise<RequestOtpResponse>;
  /** Signs in; `isNew` means the profile step comes next. */
  verifyOtp: (phone: string, code: string) => Promise<{ isNew: boolean }>;
  saveProfile: (profile: ProfileInput) => Promise<void>;
  setMe: (me: Me) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: "unknown",
  token: null,
  me: null,

  restoreToken: () => {
    const token = get().token ?? readStoredToken();
    set({ token, status: token ? "signedIn" : "signedOut" });
    return token;
  },

  requestOtp: (phone) => api.requestOtp(phone),

  verifyOtp: async (phone, code) => {
    const { token, user, is_new } = await api.verifyOtp(phone, code);
    writeStoredToken(token);
    set({ token, me: user, status: "signedIn" });
    return { isNew: is_new };
  },

  saveProfile: async ({ displayName, about, avatar }) => {
    if (avatar) await api.uploadAvatar(avatar);
    const me = await api.updateMe({ display_name: displayName, about });
    set({ me });
  },

  setMe: (me) => set({ me }),

  reset: () => {
    writeStoredToken(null);
    set({ status: "signedOut", token: null, me: null });
  },
}));

/** A new User has an empty display name until the profile step saves one. */
export const needsProfile = (me: Me | null) => me !== null && me.display_name.trim() === "";
