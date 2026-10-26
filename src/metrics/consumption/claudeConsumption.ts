import { createReadStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeHome } from '../../towers/claude/sources.ts';
import { recentLogs } from './recentLogs.ts';
import { dayKey, lastDays, summarizeDays, type DayUsage, type ToolConsumption } from './types.ts';

type Calls = Array<{ day: string; fresh: number; cached: number }>;
const cache = new Map<string, { mtime: number; calls: Calls }>();

/** API calls of one session log (deduplicated by message id), with their day. */
async function callsOf(path: string): Promise<Calls> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.calls;
  const calls: Calls = [];
  const seen = new Set<string>();
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"usage"')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d?.message;
    if (d?.type !== 'assistant' || !m?.usage || !m.id || seen.has(m.id) || typeof d.timestamp !== 'string') continue;
    seen.add(m.id);
    const u = m.usage;
    calls.push({
      day: dayKey(new Date(d.timestamp)),
      fresh: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0),
      cached: u.cache_read_input_tokens ?? 0,
    });
  }
  cache.set(path, { mtime, calls });
  return calls;
}

/** Claude Code in every folder, last 7 days. Claude Code does not record plan usage, so no windows. */
export async function claudeConsumption(limits: ToolConsumption['limits']): Promise<ToolConsumption> {
  const days = lastDays();
  for (const f of recentLogs(join(claudeHome(), 'projects'))) {
    for (const c of await callsOf(f)) {
      const d: DayUsage | undefined = days.get(c.day);
      if (!d) continue;
      d.fresh += c.fresh;
      d.cached += c.cached;
      d.calls++;
    }
  }
  return summarizeDays('claude', days, [], limits);
}
