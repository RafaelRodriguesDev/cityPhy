import { createReadStream, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { addCall, emptyTools, mergeBreakdowns, type AgentUsage, type ModelBreakdown, type ModelUsage } from './types.ts';

const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');
const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
/** Older Codex logs do not record the reasoning level. */
const UNKNOWN = 'desconhecido';

interface SessionUsage {
  cwd: string | null;
  breakdown: ModelBreakdown[];
}

const cache = new Map<string, { mtime: number; usage: SessionUsage }>();

function listLogs(dir: string): string[] {
  const out: string[] = [];
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listLogs(p));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

/** Model and reasoning level announced by a record (turn context, session meta or settings). */
function settingsOf(p: any): { model?: string; effort?: string } {
  const s = p?.collaboration_mode?.settings ?? p?.settings ?? {};
  return {
    model: p?.model ?? s.model,
    effort: p?.effort ?? p?.reasoning_effort ?? s.reasoning_effort ?? s.effort,
  };
}

/** One Codex session log: each token_count's last usage goes to the model and level in effect at that moment. */
async function readSession(path: string): Promise<SessionUsage> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.usage;

  let cwd: string | null = null;
  let model = '?';
  let effort = UNKNOWN;
  const rows = new Map<string, ModelBreakdown>();
  const seen = new Set<string>();
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"cwd"') && !line.includes('"model"') && !line.includes('token_count') && !line.includes('effort')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const p = d?.payload;
    if (!p || typeof p !== 'object') continue;
    if (typeof p.cwd === 'string') cwd = p.cwd;
    const s = settingsOf(p);
    if (typeof s.model === 'string') model = s.model;
    if (typeof s.effort === 'string') effort = s.effort;
    const last = p.type === 'token_count' ? p.info?.last_token_usage : null;
    if (last) {
      // OpenAI counts cached input inside input_tokens and reasoning inside output_tokens.
      const cached = last.cached_input_tokens ?? 0;
      addCall(rows, seen, path, model, effort, {
        input: Math.max(0, (last.input_tokens ?? 0) - cached),
        cacheWrite: last.cache_write_input_tokens ?? 0,
        cacheRead: cached,
        output: last.output_tokens ?? 0,
        reasoning: last.reasoning_output_tokens ?? 0,
      });
    }
  }
  const usage = { cwd, breakdown: [...rows.values()] };
  cache.set(path, { mtime, usage });
  return usage;
}

/** Codex's real usage in one project: sessions whose folder is the project or inside it. */
export async function codexUsage(projectPath: string): Promise<AgentUsage> {
  const root = norm(projectPath);
  const lists: ModelBreakdown[][] = [];
  let sessions = 0;
  for (const f of listLogs(join(codexHome(), 'sessions'))) {
    const s = await readSession(f);
    if (!s.cwd) continue;
    const c = norm(s.cwd);
    if (c !== root && !c.startsWith(`${root}/`)) continue;
    sessions++;
    lists.push(s.breakdown);
  }
  const breakdown = mergeBreakdowns(lists);
  const models: Record<string, ModelUsage> = {};
  for (const r of breakdown) {
    const m = (models[r.model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
    m.calls += r.calls;
    m.input += r.input;
    m.cacheWrite += r.cacheWrite;
    m.cacheRead += r.cacheRead;
    m.output += r.output;
  }
  return { sessions, models, tools: emptyTools(), breakdown };
}
