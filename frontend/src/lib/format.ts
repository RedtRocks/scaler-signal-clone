import type { Id, IsoTime, SystemEvent } from "./types";

// Formatted by hand, not with Intl: recent ICU puts U+202F before "AM", and the
// server and browser locales could differ and break hydration.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// ---- date helpers (local time) ----

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `date` to `now`: 0 = today, 1 = yesterday. */
export function daysAgo(date: Date, now: Date): number {
  // Rounding absorbs the 23- and 25-hour days around DST changes.
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

export function isSameDay(a: IsoTime, b: IsoTime): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** "9:24 AM" */
export function formatClock(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes} ${date.getHours() < 12 ? "AM" : "PM"}`;
}

const shortWeekday = (date: Date) => WEEKDAYS[date.getDay()].slice(0, 3);

/** "Oct 6", or "Oct 6, 2025" outside the current year. */
function formatMonthDay(date: Date, now: Date): string {
  const monthDay = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? monthDay : `${monthDay}, ${date.getFullYear()}`;
}

/** "Now" under a minute, "25m" under an hour, otherwise null. */
function formatRecent(date: Date, now: Date): string | null {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE_MS) return "Now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  return null;
}

// ---- timestamps ----

/** Conversation list: "Now", "25m", "9:24 AM", "Thu", "Oct 6", "Oct 6, 2025". */
export function formatListTime(iso: IsoTime, now: Date = new Date()): string {
  const date = new Date(iso);
  const recent = formatRecent(date, now);
  if (recent) return recent;
  const days = daysAgo(date, now);
  if (days === 0) return formatClock(date);
  if (days <= 6) return shortWeekday(date);
  return formatMonthDay(date, now);
}

/** Bubble footer: "Now", "25m", then the clock time. Day dividers carry the date. */
export function formatBubbleTime(iso: IsoTime, now: Date = new Date()): string {
  const date = new Date(iso);
  return formatRecent(date, now) ?? formatClock(date);
}

/** "Today", "Yesterday", "Monday", then "Mon, Oct 6" (with the year if not this one). */
export function formatDayDivider(iso: IsoTime, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = daysAgo(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 6) return WEEKDAYS[date.getDay()];
  return `${shortWeekday(date)}, ${formatMonthDay(date, now)}`;
}

/** "online", "last seen 5m ago", "last seen yesterday at 9:24 AM", "last seen Oct 6". */
export function formatLastSeen(online: boolean, lastSeenAt: IsoTime | null, now: Date = new Date()): string {
  if (online) return "online";
  if (!lastSeenAt) return "offline";
  const date = new Date(lastSeenAt);
  const recent = formatRecent(date, now);
  if (recent) return recent === "Now" ? "last seen just now" : `last seen ${recent} ago`;
  const days = daysAgo(date, now);
  if (days === 0) return `last seen today at ${formatClock(date)}`;
  if (days === 1) return `last seen yesterday at ${formatClock(date)}`;
  if (days <= 6) return `last seen ${shortWeekday(date)} at ${formatClock(date)}`;
  return `last seen ${formatMonthDay(date, now)}`;
}

// ---- disappearing timer ----

const TIMER_UNITS: [seconds: number, name: string][] = [
  [7 * 86_400, "week"],
  [86_400, "day"],
  [3_600, "hour"],
  [60, "minute"],
  [1, "second"],
];

/** "Off", "30 seconds", "5 minutes", "1 hour", "1 day", "1 week": the largest unit that divides evenly. */
export function formatTimer(seconds: number | null): string {
  if (!seconds) return "Off";
  const [size, name] = TIMER_UNITS.find(([unit]) => seconds % unit === 0)!;
  const count = seconds / size;
  return `${count} ${name}${count === 1 ? "" : "s"}`;
}

// ---- system events ----

/** "Kai", "Kai and Maya", "Kai, Maya, and Leo" */
function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The past-tense sentence Signal shows for a system Message.
 * `actorId` is the message's sender_id; `nameOf` resolves anyone else's display name.
 */
export function systemEventText(
  event: SystemEvent,
  actorId: Id | null,
  meId: Id,
  nameOf: (userId: Id) => string,
): string {
  const actor = actorId === meId ? "You" : actorId === null ? "Someone" : nameOf(actorId);
  const object = (userId: Id) => (userId === meId ? "you" : nameOf(userId));

  switch (event.type) {
    case "group_created":
      return `${actor} created the group.`;
    case "members_added":
      return `${actor} added ${joinNames(event.user_ids.map(object))}.`;
    case "member_removed":
      return `${actor} removed ${object(event.user_id)}.`;
    case "member_left":
      return `${actor} left the group.`;
    case "admin_granted":
      return `${actor} made ${object(event.user_id)} an admin.`;
    case "renamed":
      return `${actor} changed the group name to “${event.name}”.`;
    case "timer_changed":
      return event.seconds
        ? `${actor} set disappearing message time to ${formatTimer(event.seconds)}.`
        : `${actor} disabled disappearing messages.`;
  }
}

// ---- avatars ----

/** "Aarav Dudeja" → "AD", "Maya" → "M". Array.from keeps emoji and accents whole. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}
