import clsx from "clsx";
import { FIGMA_ICONS, type FigmaIconName } from "./figmaIcons";

/**
 * Desktop-only glyphs the Figma file does not draw: 24px grid, 1.6 stroke lines.
 * The first block is from the design system; the second block are additions
 * for Signal Desktop chrome (message actions, menus).
 */
const LINE_ICONS = {
  menu: "M4 7h16M4 12h16M4 17h16",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3l1.6 2.3 2.7-.6.6 2.7L19.3 9 18.6 12l.7 3-2.4 1.6-.6 2.7-2.7-.6L12 21l-1.6-2.3-2.7.6-.6-2.7L4.7 15l.7-3-.7-3 2.4-1.6.6-2.7 2.7.6z",
  stories: "M9 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM5 7v10",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01",
  note: "M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 8h6M9 11h6M9 14h6M9 17h4",
  lock: "M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3",
  close: "M6 6l12 12M18 6L6 18",
  timer: "M12 7v5l3 2M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM10 2h4",
  "leave-group": "M10 4H5.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1H10M14.5 8l4 4-4 4M18.5 12H9",
  // Additions (Signal Desktop chrome)
  reply: "M10 6.5L4.5 12l5.5 5.5M4.5 12H14a5.5 5.5 0 0 1 5.5 5.5v1",
  forward: "M14 6.5l5.5 5.5-5.5 5.5M19.5 12H10a5.5 5.5 0 0 0-5.5 5.5v1",
  copy: "M9 8.5h9.5a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1zM16 8.5V4a1 1 0 0 0-1-1H5.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8",
  trash: "M4 6.5h16M10 10.5v6M14 10.5v6M6 6.5l1 12.6A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.9l1-12.6M9 6.5V3.5h6v3",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  "chevron-down": "M6 9l6 6 6-6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  react: "M20.6 12.5a8.6 8.6 0 1 1-8.1-9.1M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01M19 2.5v5.5M16.25 5.25h5.5",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
  file: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-forward": "M9 5l7 7-7 7",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  laptop: "M5.5 6h13a.5.5 0 0 1 .5.5V15H5V6.5a.5.5 0 0 1 .5-.5zM3 18.5h18",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 16.5h.01",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  warning: "M12 3.5l9 16H3zM12 10v4.5M12 17h.01",
} as const;

export type LineIconName = keyof typeof LINE_ICONS;

const ALIAS = {
  chat: "tab-chats",
  attach: "plus",
  emoji: "smile",
  "video-call": "video-header",
  "voice-call": "phone",
} as const;

export type IconName = FigmaIconName | LineIconName | keyof typeof ALIAS;

/** Dotted glyphs read better a bit bolder. */
const HEAVY = new Set<string>(["more"]);

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Accessible name. Omit for decorative icons (aria-hidden). */
  label?: string;
  className?: string;
}

function resolve(name: IconName): FigmaIconName | LineIconName {
  return name in ALIAS ? ALIAS[name as keyof typeof ALIAS] : (name as FigmaIconName | LineIconName);
}

export function Icon({ name, size = 24, strokeWidth, label, className }: IconProps) {
  const key = resolve(name);
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  const cls = clsx("sg-icon", className);

  if (key in FIGMA_ICONS) {
    const [w, h, markup] = FIGMA_ICONS[key as FigmaIconName];
    return (
      <svg
        className={cls}
        width={size}
        height={size}
        viewBox={`0 0 ${w} ${h}`}
        fill="none"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: markup }}
        {...a11y}
      />
    );
  }

  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (HEAVY.has(key) ? 3 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      <path d={LINE_ICONS[key as LineIconName]} />
    </svg>
  );
}

export const ICON_NAMES = [
  ...Object.keys(FIGMA_ICONS),
  ...Object.keys(LINE_ICONS),
  ...Object.keys(ALIAS),
] as IconName[];
