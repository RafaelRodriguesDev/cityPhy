import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeHome } from '../../towers/claude/sources.ts';
import { recentLogs } from './recentLogs.ts';
import { WINDOW_MS, calibratedWindows, type Block, type Calibration, type PlanKind, type TimedCall } from './calibration.ts';
import { DAYS, dayKey, lastDays, summarizeDays, type DayUsage, type ToolConsumption } from './types.ts';

type Calls = Array<{ id: string; at: number; fresh: number; cached: number }>;
const cache = new Map<string, { mtime: number; calls: Calls; blocks: Block[] }>();

/** Rejections carry the window that ran out: "five_hour" (session) or "seven_day…" (week). */
const kindOf = (type: unknown): PlanKind | null => (type === 'five_hour' ? 'session' : typeof type === 'string' && type.startsWith('seven_day') ? 'week' : null);

/** A rejected rate limit anywhere in a log record: { status: "rejected", rateLimitType, resetsAt (seconds) }. */
function findBlock(v: unknown, depth = 0): Block | null {
  if (!v || typeof v !== 'object' || depth > 4) return null;
  const o = v as Record<string, unknown>;
  const kind = kindOf(o.rateLimitType);
  if (o.status === 'rejected' && kind && typeof o.resetsAt === 'number') return { kind, resetsAt: o.resetsAt * 1000 };
  for (const x of Object.values(o)) {
    const b = findBlock(x, depth + 1);
    if (b) return b;
  }
  return null;
}

/** API calls of one session log (deduplicated by message id) with their time, and the rate-limit blocks it recorded. */
async function readLog(path: string): Promise<{ calls: Calls; blocks: Block[] }> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit;
  const calls: Calls = [];
  const blocks: Block[] = [];
  const seen = new Set<string>();
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    const usage = line.includes('"usage"');
    const limit = line.includes('rateLimitType');
    if (!usage && !limit) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (limit) {
      const b = findBlock(d);
      if (b && !blocks.some((x) => x.kind === b.kind && x.resetsAt === b.resetsAt)) blocks.push(b);
    }
    const m = d?.message;
    if (d?.type !== 'assistant' || !m?.usage || !m.id || seen.has(m.id) || typeof d.timestamp !== 'string') continue;
    seen.add(m.id);
    const u = m.usage;
    calls.push({
      id: m.id,
      at: Date.parse(d.timestamp),
      fresh: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0),
      cached: u.cache_read_input_tokens ?? 0,
    });
  }
  const out = { mtime, calls, blocks };
  cache.set(path, out);
  return out;
}

/**
 * Every Claude Code call of the last 7 days, counted once across files (a resumed or forked conversation copies
 * earlier messages into a new log), and every rate-limit block recorded in that time.
 */
export async function claudeCalls(): Promise<{ calls: Array<TimedCall & { cached: number }>; blocks: Block[] }> {
  const seen = new Set<string>();
  const calls: Array<TimedCall & { cached: number }> = [];
  const blocks: Block[] = [];
  for (const f of recentLogs(join(claudeHome(), 'projects'))) {
    const log = await readLog(f);
    for (const c of log.calls) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      calls.push({ at: c.at, fresh: c.fresh, cached: c.cached });
    }
    for (const b of log.blocks) if (!blocks.some((x) => x.kind === b.kind && x.resetsAt === b.resetsAt)) blocks.push(b);
  }
  return { calls, blocks };
}

/** cityPhy's own file (in the data folder) with what the person typed from the app. */
export const calibrationPath = (dataDir: string) => join(dataDir, 'calibration.json');

export function readCalibration(dataDir: string | undefined): Calibration {
  if (!dataDir || !existsSync(calibrationPath(dataDir))) return { samples: [] };
  try {
    const all = JSON.parse(readFileSync(calibrationPath(dataDir), 'utf8'));
    return { samples: Array.isArray(all?.claude?.samples) ? all.claude.samples : [] };
  } catch {
    return { samples: [] };
  }
}

/**
 * Claude Code in every folder, last 7 days. Claude Code does not record its plan percent, so the plan windows
 * (5 hours and week) are estimated from the person's calibration and the blocks in the logs, when there are any.
 */
export async function claudeConsumption(limits: ToolConsumption['limits'], dataDir?: string): Promise<ToolConsumption> {
  const days = lastDays();
  const { calls, blocks } = await claudeCalls();
  for (const c of calls) {
    const d: DayUsage | undefined = days.get(dayKey(new Date(c.at)));
    if (!d) continue;
    d.fresh += c.fresh;
    d.cached += c.cached;
    d.calls++;
  }
  const calibration = readCalibration(dataDir);
  // Only logs changed in the last 7 days are read, so only windows that started inside them are complete.
  const now = Date.now();
  const complete = blocks.filter((b) => b.resetsAt - WINDOW_MS[b.kind] >= now - DAYS * 86_400_000);
  const out = summarizeDays('claude', days, calibratedWindows(calls, calibration, complete, now), limits);
  return { ...out, calibration };
}
