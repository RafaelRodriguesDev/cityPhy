import { createReadStream, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { ProjectConfig } from '../../config/loadConfig.ts';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';
import type { Observation } from '../schema.ts';
import type { MemoryStore } from '../store.ts';
import { observationFromClaudeHook } from './claudeHook.ts';

/** Text the person typed (drops system reminders and other tagged blocks the app adds). */
function promptText(content: unknown): string | null {
  const raw = typeof content === 'string' ? content : Array.isArray(content) ? content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n') : '';
  const text = raw.replace(/<([a-z-]+)[^>]*>[\s\S]*?<\/\1>/g, ' ').trim();
  return text.length > 2 ? text : null;
}

/** Replays one past session log through the same rules as the live hook. */
async function importSession(path: string, session: string, project: ProjectConfig): Promise<Observation[]> {
  const out: Observation[] = [];
  const pending = new Map<string, { name: string; input: Record<string, unknown> }>();
  let first: string | null = null;
  let last: string | null = null;
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.startsWith('{')) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const at = typeof d.timestamp === 'string' ? new Date(d.timestamp) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    first ??= d.timestamp;
    last = d.timestamp;
    const m = d.message;
    if (d.type === 'assistant' && Array.isArray(m?.content)) {
      for (const c of m.content) if (c?.type === 'tool_use') pending.set(c.id, { name: c.name, input: c.input ?? {} });
    } else if (d.type === 'user' && m) {
      const results = Array.isArray(m.content) ? m.content.filter((c: any) => c?.type === 'tool_result') : [];
      for (const r of results) {
        const call = pending.get(r.tool_use_id);
        if (!call) continue;
        pending.delete(r.tool_use_id);
        const o = observationFromClaudeHook({ hook_event_name: 'PostToolUse', session_id: session, tool_name: call.name, tool_input: call.input, tool_response: r.content }, project, at);
        if (o) out.push(o);
      }
      if (!results.length && !d.isMeta) {
        const prompt = promptText(m.content);
        const o = prompt && observationFromClaudeHook({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt }, project, at);
        if (o) out.push(o);
      }
    }
  }
  if (first) out.unshift({ agent: 'claude', session, at: first, kind: 'session-start', summary: 'sessão iniciada (importada)', files: [], tokens: null });
  if (last) out.push({ agent: 'claude', session, at: last, kind: 'session-end', summary: 'sessão encerrada (importada)', files: [], tokens: null });
  return out;
}

/** Imports every past Claude session of the project that is not in the store yet. */
export async function importClaudeSessions(project: ProjectConfig, store: MemoryStore): Promise<{ sessions: number; observations: number }> {
  const dir = join(claudeHome(), 'projects', projectKey(project.path));
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return { sessions: 0, observations: 0 };
  }
  let sessions = 0;
  let observations = 0;
  for (const f of files) {
    const session = f.replace(/\.jsonl$/, '');
    if (store.hasSession(session)) continue;
    const obs = await importSession(join(dir, f), session, project);
    store.addMany(obs);
    sessions++;
    observations += obs.length;
  }
  return { sessions, observations };
}
