import { SystemNotice } from "../SystemNotice/SystemNotice";
import styles from "./DateDivider.module.css";

const DAY = 86_400_000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", "Mon, Oct 6" (adds the year when it differs from `now`). */
export function formatDayLabel(date: Date, now: Date = new Date()) {
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

export interface DateDividerProps {
  /** Label shown as-is ("Today"). */
  label?: string;
  /** Or a date, formatted with formatDayLabel(date, now). */
  date?: Date;
  now?: Date;
}

export function DateDivider({ label, date, now }: DateDividerProps) {
  const text = label ?? (date ? formatDayLabel(date, now) : "");
  return (
    <SystemNotice className={styles.divider}>
      <time dateTime={date?.toISOString()}>{text}</time>
    </SystemNotice>
  );
}
