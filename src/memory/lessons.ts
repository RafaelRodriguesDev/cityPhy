import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Observation } from './schema.ts';
import type { MemoryStore } from './store.ts';
import { buildLessons } from './summarize.ts';

const MAX_SESSIONS = 30;

/** A session worth a line: the person asked something or files were changed. Imported memory notes stay searchable, not listed. */
const worthListing = (obs: Observation[]) => obs.some((o) => o.kind === 'prompt' || o.kind === 'edit') && !obs.every((o) => o.kind === 'note');

/** Rewrites `<project>/cityphy/LESSONS.md` from the store (most recently active sessions first, within the budget). */
export function refreshLessons(dir: string, store: MemoryStore, projectName: string, budgetTokens: number): string {
  // recent() is newest first, so the first time a session shows up is its latest activity.
  const order = [...new Set(store.recent(5000).map((o) => o.session))];
  const sessions = order.map((s) => store.session(s)).filter(worthListing).slice(0, MAX_SESSIONS);
  const text = buildLessons(projectName, sessions, budgetTokens);
  writeFileSync(join(dir, 'LESSONS.md'), text, 'utf8');
  return text;
}

export function readLessons(dir: string): string | null {
  const path = join(dir, 'LESSONS.md');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}
