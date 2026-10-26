import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { geminiHome } from '../../towers/antigravity/sources.ts';

// Loaded at runtime: some tools (Vitest 2) do not know the node:sqlite builtin yet.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/** Last write to an Antigravity conversation log whose workspace is this folder or below it (ISO), or null. */
export async function antigravityActivity(projectPath: string): Promise<string | null> {
  const home = geminiHome();
  const root = norm(projectPath);
  let rows: Array<{ conversation_id: string; workspace_uris: string | null }> = [];
  try {
    // Never write into the agent's own database. Node 24 supports readOnly; @types/node 22 does not list it yet.
    const db = new DatabaseSync(join(home, 'antigravity', 'conversation_summaries.db'), { readOnly: true } as ConstructorParameters<typeof DatabaseSync>[1]);
    try {
      rows = db.prepare('SELECT conversation_id, workspace_uris FROM conversation_summaries').all() as typeof rows;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
  let latest = 0;
  for (const r of rows) {
    let uris: string[] = [];
    try {
      uris = JSON.parse(r.workspace_uris ?? '[]');
    } catch {
      continue;
    }
    const inside = uris.some((u) => {
      const p = norm(decodeURIComponent(u.replace(/^file:\/\/\/?/, '')));
      return p === root || p.startsWith(`${root}/`);
    });
    if (!inside) continue;
    try {
      latest = Math.max(latest, statSync(join(home, 'antigravity', 'brain', r.conversation_id, '.system_generated', 'logs', 'transcript.jsonl')).mtimeMs);
    } catch {
      // conversation without a log on disk
    }
  }
  return latest ? new Date(latest).toISOString() : null;
}
