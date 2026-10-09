/** Signal's chat colours: the colour of my own bubbles in one chat. "default" is the app blue. */
export const CHAT_COLORS = [
  ["default", "Ultramarine", "#2c6bed"],
  ["crimson", "Crimson", "#cf163f"],
  ["vermilion", "Vermilion", "#c73f0a"],
  ["burlap", "Burlap", "#6f6a58"],
  ["forest", "Forest", "#3b7845"],
  ["wintergreen", "Wintergreen", "#1d8663"],
  ["teal", "Teal", "#077d92"],
  ["blue", "Blue", "#336ba3"],
  ["indigo", "Indigo", "#5951c8"],
  ["violet", "Violet", "#862caf"],
  ["plum", "Plum", "#a23474"],
  ["taupe", "Taupe", "#895d66"],
  ["steel", "Steel", "#6b6b78"],
] as const;

export type ChatColorName = (typeof CHAT_COLORS)[number][0];

/** The bubble colour for a stored name, or undefined for the default so the theme colour applies. */
export function chatColorHex(name: string | null | undefined): string | undefined {
  if (!name || name === "default") return undefined;
  return CHAT_COLORS.find(([id]) => id === name)?.[2];
}
