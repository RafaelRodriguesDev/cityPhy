import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import type { AgentWork, SessionWork } from './types.ts';

const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');
const norm = (s: string) => s.replace(/^file:\/+/, '').replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

interface Meta {
  id: string | null;
  cwd: string | null;
  startedAt: string | null;
  lastAt: string | null;
  turns: number;
}
const cache = new Map<string, { mtime: number; meta: Meta }>();

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

/** Session id, folder, first and last time and number of turns. The text of the messages is skipped. */
async function readMeta(path: string): Promise<Meta> {
  const mtime = statSync(path).mtimeMs;
  const hit = cache.get(path);
  if (hit && hit.mtime === mtime) return hit.meta;
  const meta: Meta = { id: null, cwd: null, startedAt: null, lastAt: null, turns: 0 };
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    const ts = /"timestamp":"([^"]+)"/.exec(line.slice(0, 120))?.[1];
    if (ts) {
      meta.startedAt ??= ts;
      meta.lastAt = ts;
    }
    if (line.includes('"task_complete"')) meta.turns++;
    if (!line.includes('"session_meta"') && !line.includes('"turn_context"')) continue;
    try {
      const p = JSON.parse(line)?.payload;
      if (typeof p?.id === 'string') meta.id ??= p.id;
      if (typeof p?.cwd === 'string') meta.cwd = p.cwd;
    } catch {
      // half-written line
    }
  }
  cache.set(path, { mtime, meta });
  return meta;
}

interface Thread {
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const iso = (sec: unknown) => (typeof sec === 'number' && sec > 0 ? new Date(sec * 1000).toISOString() : null);

/** Thread titles and dates: Codex's state database (read-only), then the older session_index.jsonl. */
function threads(): Map<string, Thread> {
  const out = new Map<string, Thread>();
  const db = join(codexHome(), 'state_5.sqlite');
  if (existsSync(db)) {
    try {
      const conn = new DatabaseSync(db, { readOnly: true } as ConstructorParameters<typeof DatabaseSync>[1]);
      try {
        for (const r of conn.prepare('SELECT id, title, created_at, updated_at FROM threads').all() as Array<Record<string, unknown>>) {
          if (r.title) out.set(String(r.id), { title: String(r.title), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) });
        }
      } finally {
        conn.close();
      }
    } catch {
      // other schema version: fall back to the index file
    }
  }
  const path = join(codexHome(), 'session_index.jsonl');
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    try {
      const r = JSON.parse(line);
      if (r?.id && r?.thread_name && !out.has(r.id)) out.set(r.id, { title: r.thread_name, createdAt: null, updatedAt: r.updated_at ?? null });
    } catch {
      // skip
    }
  }
  return out;
}

/**
 * Codex conversations whose folder is the project or inside it. Codex logs on this format do not record
 * tool calls, so only titles, dates and turns are known.
 */
export async function codexWork(projectPath: string): Promise<AgentWork> {
  const root = norm(projectPath);
  const known = threads();
  const sessions: SessionWork[] = [];
  for (const f of listLogs(join(codexHome(), 'sessions'))) {
    const m = await readMeta(f);
    if (!m.cwd) continue;
    const c = norm(m.cwd);
    if (c !== root && !c.startsWith(`${root}/`)) continue;
    const id = m.id ?? f;
    // Log migrations rewrite the last timestamps, so the thread's own dates win when Codex keeps them.
    const t = known.get(id);
    sessions.push({ agent: 'codex', session: id, title: t?.title ?? null, startedAt: t?.createdAt ?? m.startedAt, lastAt: t?.updatedAt ?? m.lastAt, turns: m.turns, skills: {}, mcp: {} });
  }
  return { agent: 'codex', sessions, toolsRecorded: false };
}
