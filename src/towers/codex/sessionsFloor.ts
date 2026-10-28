import { closeSync, openSync, readFileSync, readSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { fileStats, join, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { CodexProjectSources } from './sources.ts';

const MAX_HEADER_BYTES = 2 * 1024 * 1024;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface SessionMetadata {
  id: string | null;
  cwd: string | null;
  startedAt: string | null;
}

interface IndexedSession {
  title: string | null;
  updatedAt: string | null;
}

interface LocalProjectState {
  id?: unknown;
  rootPaths?: unknown;
}

interface GlobalState {
  'local-projects'?: Record<string, LocalProjectState>;
  'thread-project-assignments'?: Record<string, unknown>;
}

export function normalize(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
}

export function sessionIdFromPath(path: string): string | null {
  return UUID.exec(basename(path))?.[0] ?? null;
}

export function assignedProjectId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  const projectId = (value as { projectId?: unknown }).projectId;
  return typeof projectId === 'string' ? projectId : null;
}

/** Reads only the first session_meta record; conversation records are never parsed. */
export function readSessionMetadata(path: string): SessionMetadata {
  if (path.endsWith('.zst')) return { id: sessionIdFromPath(path), cwd: null, startedAt: null };
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const chunks: Buffer[] = [];
    let total = 0;
    while (total < MAX_HEADER_BYTES) {
      const buf = Buffer.alloc(Math.min(64 * 1024, MAX_HEADER_BYTES - total));
      const read = readSync(fd, buf, 0, buf.length, total);
      if (!read) break;
      chunks.push(buf.subarray(0, read));
      total += read;
      const text = Buffer.concat(chunks).toString('utf8');
      const end = text.indexOf('\n');
      if (end < 0) continue;
      const row = JSON.parse(text.slice(0, end)) as { type?: unknown; timestamp?: unknown; payload?: Record<string, unknown> };
      if (row.type !== 'session_meta' || !row.payload) break;
      const id = typeof row.payload.id === 'string' ? row.payload.id : typeof row.payload.session_id === 'string' ? row.payload.session_id : null;
      const cwd = typeof row.payload.cwd === 'string' ? row.payload.cwd : null;
      const startedAt = typeof row.payload.timestamp === 'string' ? row.payload.timestamp : typeof row.timestamp === 'string' ? row.timestamp : null;
      return { id, cwd, startedAt };
    }
  } catch {
    // A partial or changing log is skipped by returning only its filename id.
  } finally {
    if (fd !== null) closeSync(fd);
  }
  return { id: sessionIdFromPath(path), cwd: null, startedAt: null };
}

function sessionFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.jsonl(?:\.zst)?$/i.test(entry.name)) out.push(path);
    }
  };
  walk(root);
  return out.sort();
}

function asIso(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sessionIndex(home: string): Map<string, IndexedSession> {
  const out = new Map<string, IndexedSession>();
  let text = '';
  try {
    text = readFileSync(join(home, 'session_index.jsonl'), 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    try {
      const row = JSON.parse(line) as { id?: unknown; thread_name?: unknown; updated_at?: unknown };
      if (typeof row.id !== 'string') continue;
      out.set(row.id, {
        title: typeof row.thread_name === 'string' ? row.thread_name.slice(0, 120) : null,
        updatedAt: asIso(row.updated_at),
      });
    } catch {
      // Ignore a line being rewritten while the tower is generated.
    }
  }
  return out;
}

function assignedProjects(home: string, projects: CodexProjectSources[]): Map<string, CodexProjectSources> {
  const out = new Map<string, CodexProjectSources>();
  let state: GlobalState = {};
  try {
    state = JSON.parse(readText(join(home, '.codex-global-state.json')) ?? '{}') as GlobalState;
  } catch {
    return out;
  }

  const byLocalId = new Map<string, CodexProjectSources>();
  for (const [key, local] of Object.entries(state['local-projects'] ?? {})) {
    const roots = Array.isArray(local.rootPaths) ? local.rootPaths.filter((p): p is string => typeof p === 'string') : [];
    const project = projects.find((p) => roots.some((root) => normalize(root) === normalize(p.path)));
    if (project) byLocalId.set(typeof local.id === 'string' ? local.id : key, project);
  }
  for (const [thread, assignment] of Object.entries(state['thread-project-assignments'] ?? {})) {
    const localId = assignedProjectId(assignment);
    if (!localId) continue;
    const project = byLocalId.get(localId);
    if (project) out.set(thread, project);
  }
  return out;
}

export function projectForCwd(cwd: string | null, projects: CodexProjectSources[]): CodexProjectSources | null {
  if (!cwd) return null;
  const value = normalize(cwd);
  return (
    projects
      .filter((p) => value === normalize(p.path) || value.startsWith(`${normalize(p.path)}/`))
      .sort((a, b) => normalize(b.path).length - normalize(a.path).length)[0] ?? null
  );
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getDate())}/${p(date.getMonth() + 1)} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Session floors for the selected projects, using only local metadata and log file stats. */
export function addSessionFloors(t: TowerBuilder, home: string, projects: CodexProjectSources[]): void {
  const index = sessionIndex(home);
  const assignments = assignedProjects(home, projects);
  const seen = new Set<string>();

  for (const path of sessionFiles(join(home, 'sessions'))) {
    const s = fileStats(path);
    if (!s) continue;
    const metadata = readSessionMetadata(path);
    const id = metadata.id ?? sessionIdFromPath(path);
    if (!id || seen.has(id)) continue;
    const project = assignments.get(id) ?? projectForCwd(metadata.cwd, projects);
    if (!project) continue;
    seen.add(id);

    const indexed = index.get(id);
    const updatedAt = indexed?.updatedAt ?? s.updatedAt;
    const labelDate = metadata.startedAt ?? updatedAt;
    t.addFloor({
      id: `codex.sessions.${id}`,
      label: `${shortDate(labelDate)} · ${indexed?.title ?? 'sessão sem título'} · ${project.name}`,
      section: 'sessions',
      load: 'history',
      sourceFile: path,
      bytes: s.bytes,
      updatedAt,
      project: project.path,
    });
  }
}

