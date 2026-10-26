import type { ProjectConfig } from '../../config/loadConfig.ts';
import { linkFiles } from '../graphLink.ts';
import type { Observation } from '../schema.ts';

/** The JSON Claude Code sends to a hook on stdin (only the fields we use). */
export interface ClaudeHookEvent {
  hook_event_name: string;
  session_id: string;
  cwd?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
}

const oneLine = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const approxTokens = (v: unknown) => (v === undefined ? null : Math.round(JSON.stringify(v).length / 4));

/** Turns one hook event into one observation, by rules (no model involved). Null = nothing worth keeping. */
export function observationFromClaudeHook(e: ClaudeHookEvent, project: ProjectConfig, now = new Date()): Observation | null {
  const base = { agent: 'claude', session: e.session_id, at: now.toISOString() };
  const input = e.tool_input ?? {};

  switch (e.hook_event_name) {
    case 'SessionStart':
      return { ...base, kind: 'session-start', summary: 'sessão iniciada', files: [], tokens: null };
    case 'SessionEnd':
      return { ...base, kind: 'session-end', summary: 'sessão encerrada', files: [], tokens: null };
    case 'UserPromptSubmit':
      return e.prompt ? { ...base, kind: 'prompt', summary: `pedido: ${oneLine(e.prompt, 160)}`, files: [], tokens: Math.round(e.prompt.length / 4) } : null;
    case 'PostToolUse':
      break;
    default:
      return null;
  }

  const tokens = approxTokens(e.tool_response);
  const file = str(input.file_path) ?? str(input.notebook_path);
  switch (e.tool_name) {
    case 'Read':
      return { ...base, kind: 'read', summary: `leu ${linkFiles(project, [file])[0] ?? file ?? '?'}`, files: linkFiles(project, [file]), tokens };
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return { ...base, kind: 'edit', summary: `editou ${linkFiles(project, [file])[0] ?? file ?? '?'}`, files: linkFiles(project, [file]), tokens };
    case 'Grep':
    case 'Glob':
      return { ...base, kind: 'search', summary: `buscou "${oneLine(str(input.pattern) ?? '', 60)}"`, files: linkFiles(project, [str(input.path)]), tokens };
    case 'Bash':
    case 'PowerShell': {
      const cmd = str(input.command) ?? '';
      const isGraph = /\b(graphify|cityphy)(\.cmd)?\b.*\b(query|explain|path|affected)\b/.test(cmd) || /cityphy\.ts\s+query/.test(cmd);
      return { ...base, kind: isGraph ? 'graph-query' : 'command', summary: `${isGraph ? 'grafo' : 'rodou'}: ${oneLine(cmd, 120)}`, files: [], tokens };
    }
    default:
      return null;
  }
}
