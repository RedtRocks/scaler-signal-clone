"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_EVENT, applyThemePreference, readThemePreference, resolveTheme, type ThemePreference } from "./theme";

function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * [preference, setPreference]. Persists to localStorage and updates <html data-theme>.
 * While the preference is "system", follows OS light/dark changes live.
 */
export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const pref = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => document.documentElement.setAttribute("data-theme", resolveTheme("system"));
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [pref]);
  return [pref, applyThemePreference];
}
