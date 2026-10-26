import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QueryRecord } from './queryLog.ts';

export interface Savings {
  queries: number;
  returned: number;
  avoided: number;
  /** avoided - returned: tokens that did not enter the context (and were not resent after it). */
  saved: number;
  byAgent: Record<string, { queries: number; saved: number }>;
  last: QueryRecord[];
}

/** Totals of `<project>/cityphy/metrics.jsonl`. */
export function readSavings(dir: string): Savings {
  const s: Savings = { queries: 0, returned: 0, avoided: 0, saved: 0, byAgent: {}, last: [] };
  const path = join(dir, 'metrics.jsonl');
  if (!existsSync(path)) return s;
  const records: QueryRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // half-written line
    }
  }
  for (const r of records) {
    const saved = Math.max(0, r.avoided - r.returned);
    s.queries++;
    s.returned += r.returned;
    s.avoided += r.avoided;
    s.saved += saved;
    const a = (s.byAgent[r.agent] ??= { queries: 0, saved: 0 });
    a.queries++;
    a.saved += saved;
  }
  s.last = records.slice(-8).reverse();
  return s;
}
