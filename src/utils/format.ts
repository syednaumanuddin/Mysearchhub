const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative time, e.g. `just now`, `12m ago`, `3h ago`, `Feb 3`. */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const delta = now - timestamp;
  if (delta < 0) return "just now";
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function truncate(value: string, max: number, ellipsis = "…"): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - ellipsis.length)).trimEnd()}${ellipsis}`;
}

export function pluralizeSources(count: number): string {
  return `${count} ${pluralize(count, "source")}`;
}
