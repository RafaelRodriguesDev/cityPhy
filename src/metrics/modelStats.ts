// Pure comparisons between models and reasoning levels (no Node imports: used by the page too).
import type { ModelBreakdown } from './usage/types.ts';

/** Display order of reasoning levels. */
export const EFFORT_ORDER = ['minimal', 'low', 'medium', 'high', 'xhigh', 'padrão', 'desconhecido'];
export const effortRank = (e: string) => {
  const i = EFFORT_ORDER.indexOf(e);
  return i < 0 ? EFFORT_ORDER.length : i;
};

export interface ModelStat {
  model: string;
  effort: string;
  calls: number;
  sessions: number;
  total: number; // all tokens (input + cache + output)
  perCall: number;
  perSession: number;
  cacheShare: number; // 0..1 of input served from cache
  reasoningShare: number; // 0..1 of output spent reasoning
  multiplier: number | null; // from cityphy.config.json, null = not informed
  weighted: number | null; // total × multiplier
}

export type Multipliers = Record<string, { multiplier?: number }>;

export function statOf(r: ModelBreakdown, multipliers: Multipliers): ModelStat {
  const total = r.input + r.cacheWrite + r.cacheRead + r.output;
  const inputAll = r.input + r.cacheWrite + r.cacheRead;
  const m = multipliers[r.model]?.multiplier;
  return {
    model: r.model,
    effort: r.effort,
    calls: r.calls,
    sessions: r.sessions,
    total,
    perCall: r.calls ? Math.round(total / r.calls) : 0,
    perSession: r.sessions ? Math.round(total / r.sessions) : 0,
    cacheShare: inputAll ? r.cacheRead / inputAll : 0,
    reasoningShare: r.output ? r.reasoning / r.output : 0,
    multiplier: typeof m === 'number' ? m : null,
    weighted: typeof m === 'number' ? Math.round(total * m) : null,
  };
}

const rowTotal = (r: ModelBreakdown) => r.input + r.cacheWrite + r.cacheRead + r.output;

/** Models of an agent with their levels, biggest first. Rows without tokens (internal records) are left out. */
export function groupByModel(rows: ModelBreakdown[]): Array<{ model: string; rows: ModelBreakdown[]; total: number }> {
  const by = new Map<string, ModelBreakdown[]>();
  for (const r of rows) if (rowTotal(r) > 0 && !r.model.startsWith('<')) by.set(r.model, [...(by.get(r.model) ?? []), r]);
  return [...by.entries()]
    .map(([model, list]) => ({
      model,
      rows: list.sort((a, b) => effortRank(a.effort) - effortRank(b.effort)),
      total: list.reduce((s, r) => s + r.input + r.cacheWrite + r.cacheRead + r.output, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

export type TaskSize = 'pequena' | 'média' | 'grande';
const PERCENTILE: Record<TaskSize, number> = { pequena: 0.25, média: 0.5, grande: 0.75 };

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
}

/** Shortcut sizes in number of calls: quartiles of this model's real sessions (25/50/75). */
export function callPresets(rows: ModelBreakdown[]): Record<TaskSize, number> {
  const calls = rows.flatMap((r) => r.sessionCalls ?? []).filter((c) => c > 0);
  const pick = (s: TaskSize, fallback: number) => Math.max(1, percentile(calls, PERCENTILE[s]) ?? fallback);
  return { pequena: pick('pequena', 10), média: pick('média', 40), grande: pick('grande', 120) };
}

export interface Estimate {
  effort: string;
  /** ≈ tokens charged in full for N calls: uncached input + cache writes + output. */
  fresh: number;
  /** ≈ tokens read from the prompt cache for N calls (much cheaper). */
  cached: number;
  /** Part of `fresh` that is reasoning output. */
  reasoning: number;
  weighted: number | null; // fresh × multiplier
  ratio: number | null; // fresh vs the reference level
  calls: number; // real calls behind the averages
}

/**
 * "How much would a task of N calls cost at each level?": the average per call of every level this
 * model was used at here, times N. Levels never used have no row.
 */
export function estimateForCalls(rows: ModelBreakdown[], n: number, multiplier: number | null): Estimate[] {
  const list = rows
    .filter((r) => r.calls > 0)
    .map((r) => ({
      effort: r.effort,
      fresh: Math.round(((r.input + r.cacheWrite + r.output) / r.calls) * n),
      cached: Math.round((r.cacheRead / r.calls) * n),
      reasoning: Math.round((r.reasoning / r.calls) * n),
      calls: r.calls,
    }));
  const ref = list.find((e) => e.effort === 'medium') ?? [...list].sort((a, b) => b.calls - a.calls)[0];
  return list
    .sort((a, b) => effortRank(a.effort) - effortRank(b.effort))
    .map((e) => ({
      ...e,
      weighted: multiplier !== null ? Math.round(e.fresh * multiplier) : null,
      ratio: ref?.fresh ? e.fresh / ref.fresh : null,
    }));
}
