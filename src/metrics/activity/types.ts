// Pure activity types and checks (no Node imports: used by the page too).

export const DEFAULT_ACTIVE_MINUTES = 15;

export interface ActivityReport {
  /** A tool counts as working in a project when it wrote to its logs within this window. */
  windowMinutes: number;
  generatedAt: string;
  /** agent → workspace name (project or group) → last activity ISO. */
  agents: Record<string, Record<string, string>>;
}

/** Is `last` within the window, seen from `now`? */
export function isActive(last: string | null | undefined, windowMinutes: number, now: string): boolean {
  if (!last) return false;
  return Date.parse(now) - Date.parse(last) <= windowMinutes * 60_000;
}

/** "agora", "há 12 min", "há 3 h", "há 2 dias". */
export function ago(last: string | null | undefined, now: string): string {
  if (!last) return 'nunca';
  const min = Math.max(0, Math.round((Date.parse(now) - Date.parse(last)) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
}
