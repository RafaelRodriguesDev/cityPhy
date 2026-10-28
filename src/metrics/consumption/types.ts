// How much a tool (Claude Code, Codex, Antigravity...) consumed, across every folder, measured from its own logs.

/** One day of consumption (local date YYYY-MM-DD). */
export interface DayUsage {
  date: string;
  fresh: number; // uncached input + cache writes + output (what weighs on cost/limits)
  cached: number; // input read from the prompt cache
  calls: number;
}

/** A usage window the tool itself reports (e.g. Codex: 5 hours and 1 week), in real percent of the plan. */
export interface PlanWindow {
  label: string; // "5 horas", "semana"...
  minutes: number;
  usedPercent: number;
  resetsAt: string | null; // ISO
  seenAt: string; // when the tool reported it
  /** Set when the percent is cityPhy's estimate from a calibration, not reported by the tool. */
  calibrated?: { limit: number; used: number; fromApp: number; fromBlocks: number };
}

export interface ToolConsumption {
  agent: string;
  days: DayUsage[]; // last 7 days, oldest first (days without use have zeros)
  today: DayUsage;
  week: DayUsage; // sum of the 7 days
  windows: PlanWindow[]; // empty when the tool does not report its plan usage
  /** Limits the person set in cityphy.config.json → tools (fresh tokens). Null = not set. */
  limits: { daily: number | null; weekly: number | null };
  /** Claude only: what the person typed from the app (see calibration.ts). */
  calibration?: { samples: Array<{ kind: 'session' | 'week'; percent: number; resetsAt: string; at: string; tokens: number }> };
}

export const DAYS = 7;

/** Local date key of a timestamp. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Empty buckets for the last DAYS days, oldest first. */
export function lastDays(now = new Date()): Map<string, DayUsage> {
  const out = new Map<string, DayUsage>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = dayKey(d);
    out.set(date, { date, fresh: 0, cached: 0, calls: 0 });
  }
  return out;
}

/** Days → ToolConsumption totals. */
export function summarizeDays(agent: string, days: Map<string, DayUsage>, windows: PlanWindow[], limits: ToolConsumption['limits']): ToolConsumption {
  const list = [...days.values()];
  const week = list.reduce((t, d) => ({ date: 'semana', fresh: t.fresh + d.fresh, cached: t.cached + d.cached, calls: t.calls + d.calls }), { date: 'semana', fresh: 0, cached: 0, calls: 0 });
  return { agent, days: list, today: list[list.length - 1], week, windows, limits };
}

/** Fill of a block 0..1, or null when there is no 100% to compare with. */
export function fillOf(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(1, used / limit);
}
