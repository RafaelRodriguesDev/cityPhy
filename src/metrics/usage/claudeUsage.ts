import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';
import type { AgentUsage, ModelUsage, ToolCategory } from './types.ts';

const GRAPH = /\b(graphify|cityphy)(\.cmd)?\b.*\b(query|explain|path|affected)\b|cityphy\.ts\s+query/;

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

interface FileUsage {
  models: Record<string, ModelUsage>;
  tools: Record<ToolCategory, number>;
}

const cache = new Map<string, { mtime: number; usage: FileUsage }>();

/** Real usage of one session log: API usage per model (deduplicated by message id) and tool output per category. */
async function readSession(path: string): Promise<FileUsage> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.usage;

  const usage: FileUsage = { models: {}, tools: { file: 0, search: 0, graph: 0, command: 0, other: 0 } };
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
        const u = (usage.models[m.model ?? '?'] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
        u.calls++;
        u.input += m.usage.input_tokens ?? 0;
        u.cacheWrite += m.usage.cache_creation_input_tokens ?? 0;
        u.cacheRead += m.usage.cache_read_input_tokens ?? 0;
        u.output += m.usage.output_tokens ?? 0;
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
  const total: AgentUsage = { sessions: files.length, models: {}, tools: { file: 0, search: 0, graph: 0, command: 0, other: 0 } };
  for (const f of files) {
    const u = await readSession(join(dir, f));
    for (const [model, mu] of Object.entries(u.models)) {
      const t = (total.models[model] ??= { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });
      t.calls += mu.calls;
      t.input += mu.input;
      t.cacheWrite += mu.cacheWrite;
      t.cacheRead += mu.cacheRead;
      t.output += mu.output;
    }
    for (const k of Object.keys(u.tools) as ToolCategory[]) total.tools[k] += u.tools[k];
  }
  return total;
}
