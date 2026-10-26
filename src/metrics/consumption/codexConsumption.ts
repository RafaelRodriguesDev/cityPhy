import { createReadStream, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { recentLogs } from './recentLogs.ts';
import { dayKey, lastDays, summarizeDays, type PlanWindow, type ToolConsumption } from './types.ts';

const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');

interface Parsed {
  calls: Array<{ day: string; fresh: number; cached: number }>;
  windows: PlanWindow[]; // last report in this log
}
const cache = new Map<string, { mtime: number; parsed: Parsed }>();

const windowLabel = (minutes: number) => (minutes === 300 ? '5 horas' : minutes === 10080 ? 'semana' : minutes % 1440 === 0 ? `${minutes / 1440} dia(s)` : `${minutes} min`);

/** token_count events of one Codex log: per-call usage and the plan windows Codex reported. */
async function parse(path: string): Promise<Parsed> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.parsed;
  const parsed: Parsed = { calls: [], windows: [] };
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('token_count')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const p = d?.payload;
    if (p?.type !== 'token_count' || typeof d.timestamp !== 'string') continue;
    const last = p.info?.last_token_usage;
    if (last) {
      // OpenAI counts cached input inside input_tokens.
      const cached = last.cached_input_tokens ?? 0;
      parsed.calls.push({
        day: dayKey(new Date(d.timestamp)),
        fresh: Math.max(0, (last.input_tokens ?? 0) - cached) + (last.cache_write_input_tokens ?? 0) + (last.output_tokens ?? 0),
        cached,
      });
    }
    const rl = p.rate_limits;
    if (rl) {
      parsed.windows = (['primary', 'secondary'] as const)
        .map((k) => rl[k])
        .filter((w) => w && typeof w.used_percent === 'number')
        .map((w) => ({
          label: windowLabel(w.window_minutes),
          minutes: w.window_minutes,
          usedPercent: w.used_percent,
          resetsAt: typeof w.resets_at === 'number' ? new Date(w.resets_at * 1000).toISOString() : null,
          seenAt: d.timestamp,
        }));
    }
  }
  cache.set(path, { mtime, parsed });
  return parsed;
}

/** Codex in every folder, last 7 days, plus the latest plan windows it reported (real percent). */
export async function codexConsumption(limits: ToolConsumption['limits']): Promise<ToolConsumption> {
  const days = lastDays();
  let windows: PlanWindow[] = [];
  for (const f of recentLogs(join(codexHome(), 'sessions'))) {
    const p = await parse(f);
    for (const c of p.calls) {
      const d = days.get(c.day);
      if (!d) continue;
      d.fresh += c.fresh;
      d.cached += c.cached;
      d.calls++;
    }
    if (p.windows.length && (!windows.length || p.windows[0].seenAt > windows[0].seenAt)) windows = p.windows;
  }
  // A window that already reset says nothing about now.
  const now = new Date().toISOString();
  windows = windows.map((w) => (w.resetsAt && w.resetsAt < now ? { ...w, usedPercent: 0 } : w));
  return summarizeDays('codex', days, windows, limits);
}
