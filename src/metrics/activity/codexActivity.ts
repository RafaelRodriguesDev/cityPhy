import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { recentLogs } from '../consumption/recentLogs.ts';

const codexHome = () => process.env.CODEX_HOME ?? join(homedir(), '.codex');
const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
/** A session's folder never changes, so it is read once per log (from its first lines). */
const cwdCache = new Map<string, string | null>();

function cwdOf(path: string): string | null {
  if (cwdCache.has(path)) return cwdCache.get(path)!;
  let cwd: string | null = null;
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(buf.toString('utf8', 0, n));
    cwd = m ? JSON.parse(`"${m[1]}"`) : null;
  } finally {
    closeSync(fd);
  }
  cwdCache.set(path, cwd);
  return cwd;
}

/** Last write to a Codex session log opened in this folder or below it (ISO), or null. */
export async function codexActivity(projectPath: string): Promise<string | null> {
  const root = norm(projectPath);
  let latest = 0;
  for (const f of recentLogs(join(codexHome(), 'sessions'))) {
    const cwd = cwdOf(f);
    if (!cwd) continue;
    const c = norm(cwd);
    if (c !== root && !c.startsWith(`${root}/`)) continue;
    latest = Math.max(latest, statSync(f).mtimeMs);
  }
  return latest ? new Date(latest).toISOString() : null;
}
