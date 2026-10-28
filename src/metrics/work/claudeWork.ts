import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';
import { splitMcpTool, type AgentWork, type SessionWork } from './types.ts';

const cache = new Map<string, { mtime: number; work: SessionWork }>();
/** A slash command the person typed: only its name is taken. */
const COMMAND = /<command-name>\/?([\w:.-]+)<\/command-name>/;

/** One Claude session log: title, first and last time, Skill tool calls, slash commands and mcp__ tool calls. */
async function readSession(path: string, session: string): Promise<SessionWork> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.work;
  const w: SessionWork = { agent: 'claude', session, title: null, startedAt: null, lastAt: null, turns: 0, skills: {}, mcp: {} };
  const replies = new Set<string>();
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d?.type === 'custom-title' && typeof d.customTitle === 'string') w.title = d.customTitle;
    if (typeof d?.timestamp === 'string') {
      w.startedAt ??= d.timestamp;
      w.lastAt = d.timestamp;
    }
    const m = d?.message;
    if (d?.type === 'assistant' && m) {
      if (m.id) replies.add(m.id);
      for (const c of Array.isArray(m.content) ? m.content : []) {
        if (c?.type !== 'tool_use') continue;
        if (c.name === 'Skill' && typeof c.input?.skill === 'string') w.skills[c.input.skill] = (w.skills[c.input.skill] ?? 0) + 1;
        const mcp = splitMcpTool(String(c.name));
        if (mcp) {
          const tools = (w.mcp[mcp[0]] ??= {});
          tools[mcp[1]] = (tools[mcp[1]] ?? 0) + 1;
        }
      }
    } else if (d?.type === 'user' && typeof m?.content === 'string') {
      const cmd = COMMAND.exec(m.content)?.[1];
      if (cmd) w.skills[cmd] = (w.skills[cmd] ?? 0) + 1;
    }
  }
  w.turns = replies.size;
  cache.set(path, { mtime, work: w });
  return w;
}

/** Every Claude conversation in a project folder (~/.claude/projects/<key>). Read-only. */
export async function claudeWork(projectPath: string): Promise<AgentWork> {
  const dir = join(claudeHome(), 'projects', projectKey(projectPath));
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    // no sessions here
  }
  const sessions: SessionWork[] = [];
  for (const f of files) sessions.push(await readSession(join(dir, f), f.replace(/\.jsonl$/, '')));
  return { agent: 'claude', sessions, toolsRecorded: true };
}
