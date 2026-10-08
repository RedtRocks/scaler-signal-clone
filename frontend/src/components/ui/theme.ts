/** Theme preference shared by the root layout's pre-paint script and the settings UI. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "signal-theme";

/** Inline script for <head>: applies data-theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Persist the preference and apply it to <html data-theme>. Client only. */
export function applyThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.setAttribute("data-theme", resolveTheme(pref));
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Fired on window after applyThemePreference. */
export const THEME_EVENT = "signal-theme-change";
