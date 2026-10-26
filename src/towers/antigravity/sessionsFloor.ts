import { DatabaseSync } from 'node:sqlite';
import { fileStats, join, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { AntigravityProjectSources } from './sources.ts';

function shortDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface SummaryRow {
  conversation_id: string;
  title: string | null;
  workspace_uris: string | null;
  last_modified_time: string | null;
}

function normalize(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
}

/** Extracts fallback title from .pbtxt annotation if summary title is empty. */
function fallbackTitle(home: string, id: string): string | null {
  const pbtxt = readText(join(home, 'antigravity', 'annotations', `${id}.pbtxt`));
  if (!pbtxt) return null;
  const match = /title:\s*"((?:[^"\\]|\\.)*)"/.exec(pbtxt);
  return match ? match[1].replace(/\\"/g, '"') : null;
}

/** Session floors: conversation logs belonging to this project. History, not loaded. */
export function addSessionFloors(t: TowerBuilder, home: string, p: AntigravityProjectSources): void {
  const dbPath = join(home, 'antigravity', 'conversation_summaries.db');
  const brainDir = join(home, 'antigravity', 'brain');
  let db: DatabaseSync | null = null;
  try {
    // Never write into the agent's own database. Node 24 supports readOnly; @types/node 22 does not list it yet.
    db = new DatabaseSync(dbPath, { readOnly: true } as ConstructorParameters<typeof DatabaseSync>[1]);
  } catch {
    return;
  }

  const normProjectPath = normalize(p.path);

  try {
    const rows = db
      .prepare('SELECT conversation_id, title, workspace_uris, last_modified_time FROM conversation_summaries')
      .all() as unknown as SummaryRow[];

    for (const row of rows) {
      if (!row.workspace_uris) continue;
      let uris: string[] = [];
      try {
        uris = JSON.parse(row.workspace_uris);
      } catch {
        continue;
      }

      const matches = uris.some((u) => {
        const decoded = decodeURIComponent(u.replace(/^file:\/\/\/?/, ''));
        return normalize(decoded).startsWith(normProjectPath);
      });

      if (!matches) continue;

      const logPath = join(brainDir, row.conversation_id, '.system_generated', 'logs', 'transcript.jsonl');
      const s = fileStats(logPath);
      const when = row.last_modified_time ?? s?.updatedAt ?? new Date().toISOString();
      const rawTitle = row.title && row.title.trim().length > 0 ? row.title : fallbackTitle(home, row.conversation_id);
      const title = rawTitle ?? 'sessão sem título';

      t.addFloor({
        id: `antigravity.sessions.${row.conversation_id}`,
        label: `${shortDate(when)} · ${title} · ${p.name}`,
        section: 'sessions',
        load: 'history',
        sourceFile: s ? logPath : `(brain/${row.conversation_id})`,
        bytes: s?.bytes ?? null,
        updatedAt: when,
        project: p.path,
      });
    }
  } finally {
    db.close();
  }
}
