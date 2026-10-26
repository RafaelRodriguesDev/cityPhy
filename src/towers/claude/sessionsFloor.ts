import { closeSync, openSync, readSync } from 'node:fs';
import { fileStats, join, listDir } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { ClaudeProjectSources } from './sources.ts';

const CHUNK = 1 << 20;

/**
 * Reads only what the floor needs from a session log: the first timestamp and the last
 * session title. The conversation itself is never copied into the tower.
 */
function sessionInfo(path: string): { title: string | null; startedAt: string | null } {
  let title: string | null = null;
  let startedAt: string | null = null;
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(CHUNK);
    let tail = '';
    for (let pos = 0; ; pos += CHUNK) {
      const n = readSync(fd, buf, 0, CHUNK, pos);
      if (n === 0) break;
      const text = tail + buf.toString('utf8', 0, n);
      if (!startedAt) startedAt = /"timestamp":"([^"]+)"/.exec(text)?.[1] ?? null;
      for (const m of text.matchAll(/"customTitle":"((?:[^"\\]|\\.){1,120})"/g)) title = JSON.parse(`"${m[1]}"`);
      tail = text.slice(-400);
    }
  } finally {
    closeSync(fd);
  }
  return { title, startedAt };
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Session floors: one per conversation log of this project. History, not loaded. */
export function addSessionFloors(t: TowerBuilder, p: ClaudeProjectSources): void {
  for (const file of listDir(p.data).filter((f) => f.endsWith('.jsonl'))) {
    const path = join(p.data, file);
    const s = fileStats(path);
    if (!s) continue;
    const { title, startedAt } = sessionInfo(path);
    const when = startedAt ?? s.updatedAt;
    t.addFloor({
      id: `claude.sessions.${file.replace(/\.jsonl$/, '')}`,
      label: `${shortDate(when)} · ${title ?? 'sessão sem título'} · ${p.name}`,
      section: 'sessions',
      load: 'history',
      sourceFile: path,
      bytes: s.bytes,
      updatedAt: when,
      project: p.path,
    });
  }
}
