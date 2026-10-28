import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';
import { addCall, emptyTools, type AgentUsage, type ModelBreakdown, type ToolCategory } from './types.ts';

const GRAPH = /\b(graphify|cityphy)(\.cmd)?\b.*\b(query|explain|path|affected)\b|cityphy\.ts\s+query/;
/** Claude Code does not record a reasoning level per call. */
const EFFORT = 'padrão';

function categoryOf(name: string, input: Record<string, unknown> | undefined): ToolCategory {
  if (name === 'Read') return 'file';
  if (name === 'Grep' || name === 'Glob') return 'search';
  if (name === 'Bash' || name === 'PowerShell') return GRAPH.test(String(input?.command ?? '')) ? 'graph' : 'command';
  return 'other';
}

const textLength = (content: unknown): number => {
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) return content.reduce((n, c) => n + (typeof c?.text === 'string' ? c.text.length : 0), 0);
  return 0;
};

type Call = Parameters<typeof addCall>[5];

interface FileUsage {
  /** API calls by message id (a resumed conversation copies earlier ones into its new log). */
  calls: Array<{ id: string; model: string; call: Call }>;
  tools: Record<ToolCategory, number>;
}

const cache = new Map<string, { mtime: number; usage: FileUsage }>();

/** Real usage of one session log: API usage per model (deduplicated by message id) and tool output per category. */
async function readSession(path: string): Promise<FileUsage> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.usage;

  const usage: FileUsage = { calls: [], tools: emptyTools() };
  const seen = new Set<string>();
  const toolCategory = new Map<string, ToolCategory>();
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"usage"') && !line.includes('tool_result') && !line.includes('tool_use')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d?.message;
    if (d?.type === 'assistant' && m) {
      for (const c of Array.isArray(m.content) ? m.content : []) if (c?.type === 'tool_use') toolCategory.set(c.id, categoryOf(c.name, c.input));
      if (m.usage && m.id && !seen.has(m.id)) {
        seen.add(m.id);
        const model = m.model ?? '?';
        const call = {
          input: m.usage.input_tokens ?? 0,
          cacheWrite: m.usage.cache_creation_input_tokens ?? 0,
          cacheRead: m.usage.cache_read_input_tokens ?? 0,
          output: m.usage.output_tokens ?? 0,
          reasoning: m.usage.output_tokens_details?.thinking_tokens ?? 0,
        };
        usage.calls.push({ id: m.id, model, call });
      }
    } else if (d?.type === 'user' && m && Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c?.type !== 'tool_result') continue;
        usage.tools[toolCategory.get(c.tool_use_id) ?? 'other'] += Math.round(textLength(c.content) / 4);
      }
    }
  }
  cache.set(path, { mtime, usage });
  return usage;
}

/** Claude's real usage in one project: every session log under ~/.claude/projects/<key>. */
export async function claudeUsage(projectPath: string): Promise<AgentUsage> {
  const dir = join(claudeHome(), 'projects', projectKey(projectPath));
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    // no sessions in this project
  }
  const total: AgentUsage = { sessions: files.length, models: {}, tools: emptyTools(), breakdown: [] };
  const rows = new Map<string, ModelBreakdown>();
  const sessionSeen = new Set<string>();
  const seen = new Set<string>();
  for (const f of files) {
    const u = await readSession(join(dir, f));
    for (const { id, model, call } of u.calls) {
      if (seen.has(id)) continue;
      seen.add(id);
      const t = (total.models[model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
      t.calls++;
      t.input += call.input;
      t.cacheWrite += call.cacheWrite;
      t.cacheRead += call.cacheRead;
      t.output += call.output;
      addCall(rows, sessionSeen, f, model, EFFORT, call);
    }
    for (const k of Object.keys(u.tools) as ToolCategory[]) total.tools[k] += u.tools[k];
  }
  total.breakdown = [...rows.values()];
  return total;
}
