/** Tokens reported by the model API for one model. */
export interface ModelUsage {
  calls: number;
  input: number; // uncached input
  cacheWrite: number; // input written to the prompt cache
  cacheRead: number; // input served from the prompt cache (cheap)
  output: number; // all output, reasoning included
}

/** One model at one reasoning level ("padrão" when the agent does not record a level). */
export interface ModelBreakdown extends ModelUsage {
  model: string;
  effort: string;
  reasoning: number; // part of `output` spent on reasoning/thinking
  sessions: number;
  /** Total tokens of each session that used this model/level (for size percentiles). */
  sessionTotals: number[];
}

/** Where the context that tools brought in came from. */
export type ToolCategory = 'file' | 'search' | 'graph' | 'command' | 'other';

/** Real usage of one agent in one project, read from its own session logs. */
export interface AgentUsage {
  sessions: number;
  models: Record<string, ModelUsage>;
  /** ≈ tokens of tool output per category (what entered the context). */
  tools: Record<ToolCategory, number>;
  /** Per model and reasoning level. */
  breakdown: ModelBreakdown[];
}

export const emptyTools = (): Record<ToolCategory, number> => ({ file: 0, search: 0, graph: 0, command: 0, other: 0 });

/** Adds one call to the (model, effort) row of `rows`, counting the session once. */
export function addCall(
  rows: Map<string, ModelBreakdown>,
  sessionSeen: Set<string>,
  session: string,
  model: string,
  effort: string,
  u: { input: number; cacheWrite: number; cacheRead: number; output: number; reasoning: number },
): ModelBreakdown {
  const key = `${model}\u0000${effort}`;
  const row = rows.get(key) ?? { model, effort, calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, sessions: 0, sessionTotals: [] };
  rows.set(key, row);
  row.calls++;
  row.input += u.input;
  row.cacheWrite += u.cacheWrite;
  row.cacheRead += u.cacheRead;
  row.output += u.output;
  row.reasoning += u.reasoning;
  if (!sessionSeen.has(`${key}\u0000${session}`)) {
    sessionSeen.add(`${key}\u0000${session}`);
    row.sessions++;
    row.sessionTotals.push(0);
  }
  row.sessionTotals[row.sessionTotals.length - 1] += u.input + u.cacheWrite + u.cacheRead + u.output;
  return row;
}

/** Merges breakdown rows of several projects (same model and level are summed). */
export function mergeBreakdowns(lists: ModelBreakdown[][]): ModelBreakdown[] {
  const out = new Map<string, ModelBreakdown>();
  for (const r of lists.flat()) {
    const key = `${r.model}\u0000${r.effort}`;
    const t = out.get(key);
    if (!t) {
      out.set(key, { ...r, sessionTotals: [...r.sessionTotals] });
      continue;
    }
    t.calls += r.calls;
    t.input += r.input;
    t.cacheWrite += r.cacheWrite;
    t.cacheRead += r.cacheRead;
    t.output += r.output;
    t.reasoning += r.reasoning;
    t.sessions += r.sessions;
    t.sessionTotals.push(...r.sessionTotals);
  }
  return [...out.values()];
}
