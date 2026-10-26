import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DAYS } from './types.ts';

/** Every *.jsonl under `dir` changed in the last DAYS days (older logs cannot hold recent calls). */
export function recentLogs(dir: string, now = Date.now()): string[] {
  const since = now - DAYS * 86_400_000;
  const out: string[] = [];
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...recentLogs(p, now));
    else if (e.name.endsWith('.jsonl')) {
      try {
        if (statSync(p).mtimeMs >= since) out.push(p);
      } catch {
        // removed while listing
      }
    }
  }
  return out;
}
