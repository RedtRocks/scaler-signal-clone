// Tiny shared store for local-only UI preferences, kept in localStorage under one key.
// The composer reads "enterSends" through readPreference(); everything else is only used by Settings.
import { useCallback, useSyncExternalStore } from "react";

export interface Preferences {
  /** Enter sends the message (Shift+Enter adds a line). When off, Enter adds a line and Ctrl/Cmd+Enter sends. */
  enterSends: boolean;
  /** Show a text preview in notifications. Local only: this build does not send push notifications. */
  notifyPreview: boolean;
  /** Play a sound for incoming messages. Local only. */
  notifySound: boolean;
  /** Desktop notifications. Local only. */
  notifyDesktop: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  enterSends: true,
  notifyPreview: true,
  notifySound: true,
  notifyDesktop: true,
};

export const PREFERENCES_KEY = "signal.prefs";
const EVENT = "signal-prefs-change";

let cache: { raw: string | null; value: Preferences } | null = null;

function load(): Preferences {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFERENCES_KEY);
  } catch {
    return DEFAULT_PREFERENCES;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = DEFAULT_PREFERENCES;
  try {
    if (raw) value = { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    // A corrupt value falls back to the defaults.
  }
  cache = { raw, value };
  return value;
}

/** For non-React code and event handlers (e.g. the composer's Enter key). Safe during SSR. */
export function readPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES[key];
  return load()[key];
}

export function writePreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...load(), [key]: value }));
  } catch {
    // Storage is blocked; the change lasts only until reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** [value, setValue] for one preference; updates live across tabs. */
export function usePreference<K extends keyof Preferences>(key: K): [Preferences[K], (value: Preferences[K]) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => load()[key],
    () => DEFAULT_PREFERENCES[key],
  );
  const set = useCallback((next: Preferences[K]) => writePreference(key, next), [key]);
  return [value, set];
}
