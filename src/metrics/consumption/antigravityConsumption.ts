import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { geminiHome } from '../../towers/antigravity/sources.ts';
import { recentLogs } from './recentLogs.ts';
import { dayKey, lastDays, summarizeDays, type DayUsage, type ToolConsumption } from './types.ts';

type Calls = Array<{ day: string; fresh: number; cached: number }>;
const cache = new Map<string, { mtime: number; calls: Calls }>();

/** API calls of one Antigravity session log, with their day. */
async function callsOf(path: string): Promise<Calls> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.calls;
  const calls: Calls = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('PLANNER_RESPONSE')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d?.type !== 'PLANNER_RESPONSE' || typeof d.created_at !== 'string') continue;
    calls.push({
      day: dayKey(new Date(d.created_at)),
      fresh: (d.input_tokens ?? 0) + (d.output_tokens ?? 0),
      cached: d.cache_read_tokens ?? 0,
    });
  }
  cache.set(path, { mtime, calls });
  return calls;
}

/** Antigravity across all folders, last 7 days. */
export async function antigravityConsumption(limits: ToolConsumption['limits']): Promise<ToolConsumption> {
  const days = lastDays();
  const brainDir = join(geminiHome(), 'antigravity', 'brain');
  for (const f of recentLogs(brainDir)) {
    for (const c of await callsOf(f)) {
      const d: DayUsage | undefined = days.get(c.day);
      if (!d) continue;
      d.fresh += c.fresh;
      d.cached += c.cached;
      d.calls++;
    }
  }
  return summarizeDays('antigravity', days, [], limits);
}
