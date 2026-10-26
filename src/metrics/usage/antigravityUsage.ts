import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { geminiHome } from '../../towers/antigravity/sources.ts';
import { addCall, emptyTools, mergeBreakdowns, type AgentUsage, type ModelBreakdown, type ModelUsage, type ToolCategory } from './types.ts';

const GRAPH = /\b(graphify|cityphy)(\.cmd)?\b.*\b(query|explain|path|affected)\b|cityphy\.ts\s+query/;
const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

function categoryOf(name: string, args: Record<string, unknown> | undefined): ToolCategory {
  if (name === 'read_file' || name === 'write_file' || name === 'edit_file') return 'file';
  if (name === 'search_web') return 'search';
  if (name === 'run_command') return GRAPH.test(String(args?.CommandLine ?? '')) ? 'graph' : 'command';
  return 'other';
}

interface FileUsage {
  models: Record<string, ModelUsage>;
  tools: Record<ToolCategory, number>;
  breakdown: ModelBreakdown[];
}

const cache = new Map<string, { mtime: number; usage: FileUsage }>();

async function readSession(path: string, session: string): Promise<FileUsage> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.usage;

  const usage: FileUsage = { models: {}, tools: emptyTools(), breakdown: [] };
  const rows = new Map<string, ModelBreakdown>();
  const sessionSeen = new Set<string>();

  // Only what the log says: until a "Model Selection" line appears, the model is unknown.
  let model = 'desconhecido';
  let effort = 'padrão';

  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.includes('Model Selection')) {
      const m = /setting `Model Selection` from \w+ to ([^(<\n]+)(?:\s*\(([^)]+)\))?/.exec(line);
      if (m) {
        model = m[1].trim();
        effort = m[2]?.trim().toLowerCase() ?? 'padrão';
      }
    }

    if (!line.includes('PLANNER_RESPONSE')) continue;

    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }

    if (d?.type !== 'PLANNER_RESPONSE' || (!d.input_tokens && !d.output_tokens)) continue;

    const call = {
      input: d.input_tokens ?? 0,
      cacheWrite: 0,
      cacheRead: d.cache_read_tokens ?? 0,
      output: d.output_tokens ?? 0,
      reasoning: typeof d.thinking === 'string' ? Math.round(d.thinking.length / 4) : 0,
    };

    const u = (usage.models[model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
    u.calls++;
    u.input += call.input;
    u.cacheWrite += call.cacheWrite;
    u.cacheRead += call.cacheRead;
    u.output += call.output;

    addCall(rows, sessionSeen, session, model, effort, call);

    // Tool output size is not in this record; count calls per category only when a size is known.
    for (const tc of d.tool_calls ?? []) {
      const size = typeof tc?.result === 'string' ? tc.result.length : 0;
      if (size) usage.tools[categoryOf(tc?.name ?? '', tc?.args)] += Math.round(size / 4);
    }
  }

  usage.breakdown = [...rows.values()];
  cache.set(path, { mtime, usage });
  return usage;
}

interface SummaryRow {
  conversation_id: string;
  workspace_uris: string | null;
}

/** Antigravity's real usage in one project, read from its own session logs. */
export async function antigravityUsage(projectPath: string): Promise<AgentUsage> {
  const home = geminiHome();
  const dbPath = join(home, 'antigravity', 'conversation_summaries.db');
  const brainDir = join(home, 'antigravity', 'brain');

  let db: DatabaseSync | null = null;
  try {
    // Never write into the agent's own database. Node 24 supports readOnly; @types/node 22 does not list it yet.
    db = new DatabaseSync(dbPath, { readOnly: true } as ConstructorParameters<typeof DatabaseSync>[1]);
  } catch {
    return { sessions: 0, models: {}, tools: emptyTools(), breakdown: [] };
  }

  const root = norm(projectPath);
  const matchedSessionIds: string[] = [];

  try {
    const rows = db.prepare('SELECT conversation_id, workspace_uris FROM conversation_summaries').all() as unknown as SummaryRow[];
    for (const r of rows) {
      if (!r.workspace_uris) continue;
      let uris: string[] = [];
      try {
        uris = JSON.parse(r.workspace_uris);
      } catch {
        continue;
      }
      const matches = uris.some((u) => {
        const decoded = decodeURIComponent(u.replace(/^file:\/\/\/?/, ''));
        return norm(decoded).startsWith(root);
      });
      if (matches) matchedSessionIds.push(r.conversation_id);
    }
  } finally {
    db.close();
  }

  const total: AgentUsage = { sessions: matchedSessionIds.length, models: {}, tools: emptyTools(), breakdown: [] };
  const lists: ModelBreakdown[][] = [];

  for (const id of matchedSessionIds) {
    const logPath = join(brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
    if (!existsSync(logPath)) continue;
    const u = await readSession(logPath, id);
    for (const [model, mu] of Object.entries(u.models)) {
      const t = (total.models[model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
      t.calls += mu.calls;
      t.input += mu.input;
      t.cacheWrite += mu.cacheWrite;
      t.cacheRead += mu.cacheRead;
      t.output += mu.output;
    }
    for (const k of Object.keys(u.tools) as ToolCategory[]) total.tools[k] += u.tools[k];
    lists.push(u.breakdown);
  }

  total.breakdown = mergeBreakdowns(lists);
  return total;
}
