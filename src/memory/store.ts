import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type { Observation } from './schema.ts';

// Loaded at runtime: some tools (Vitest 2) do not know the node:sqlite builtin yet.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

/** One SQLite file per project (`memory.db`), with full-text search (FTS5, bundled with Node). */
export class MemoryStore {
  private readonly db: DatabaseSyncType;

  constructor(dir: string, readOnly = false) {
    if (!readOnly) mkdirSync(dir, { recursive: true });
    // readOnly exists in Node 24; @types/node 22 does not list it yet.
    this.db = new DatabaseSync(join(dir, 'memory.db'), { readOnly } as ConstructorParameters<typeof DatabaseSync>[1]);
    if (!readOnly) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS observations (
          id INTEGER PRIMARY KEY, agent TEXT, session TEXT, at TEXT, kind TEXT,
          summary TEXT, files TEXT, tokens INTEGER);
        CREATE INDEX IF NOT EXISTS obs_session ON observations(session);
        CREATE VIRTUAL TABLE IF NOT EXISTS obs_fts USING fts5(summary, files, content='observations', content_rowid='id');
        CREATE TRIGGER IF NOT EXISTS obs_ai AFTER INSERT ON observations BEGIN
          INSERT INTO obs_fts(rowid, summary, files) VALUES (new.id, new.summary, new.files);
        END;`);
    }
  }

  static exists(dir: string): boolean {
    return existsSync(join(dir, 'memory.db'));
  }

  hasSession(session: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM observations WHERE session = ? LIMIT 1').get(session);
  }

  /** Inserts many observations in one transaction (imports). */
  addMany(list: Observation[]): void {
    this.db.exec('BEGIN');
    try {
      for (const o of list) this.add(o);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  deleteSession(session: string): void {
    const ids = this.db.prepare('SELECT id, summary, files FROM observations WHERE session = ?').all(session) as Array<Record<string, unknown>>;
    for (const r of ids) {
      this.db.prepare("INSERT INTO obs_fts(obs_fts, rowid, summary, files) VALUES ('delete', ?, ?, ?)").run(Number(r.id), String(r.summary), String(r.files));
    }
    this.db.prepare('DELETE FROM observations WHERE session = ?').run(session);
  }

  add(o: Observation): void {
    this.db
      .prepare('INSERT INTO observations (agent, session, at, kind, summary, files, tokens) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(o.agent, o.session, o.at, o.kind, o.summary, JSON.stringify(o.files), o.tokens);
  }

  private rows(sql: string, ...params: Array<string | number>): Observation[] {
    return (this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>).map((r) => ({
      id: Number(r.id),
      agent: String(r.agent),
      session: String(r.session),
      at: String(r.at),
      kind: r.kind as Observation['kind'],
      summary: String(r.summary),
      files: JSON.parse(String(r.files ?? '[]')),
      tokens: r.tokens === null ? null : Number(r.tokens),
    }));
  }

  /** Full-text search; words are matched as prefixes. */
  search(query: string, limit = 10): Observation[] {
    const terms = query.match(/[\p{L}\p{N}_]+/gu) ?? [];
    if (!terms.length) return [];
    const match = terms.map((t) => `"${t}"*`).join(' ');
    return this.rows(
      `SELECT o.* FROM obs_fts f JOIN observations o ON o.id = f.rowid WHERE obs_fts MATCH ? ORDER BY o.at DESC LIMIT ?`,
      match,
      limit,
    );
  }

  recent(limit = 20, kinds?: Observation['kind'][]): Observation[] {
    if (!kinds?.length) return this.rows('SELECT * FROM observations ORDER BY at DESC LIMIT ?', limit);
    const marks = kinds.map(() => '?').join(',');
    return this.rows(`SELECT * FROM observations WHERE kind IN (${marks}) ORDER BY at DESC LIMIT ?`, ...kinds, limit);
  }

  session(session: string): Observation[] {
    return this.rows('SELECT * FROM observations WHERE session = ? ORDER BY at', session);
  }

  stats(): { observations: number; sessions: number; last: string | null; byAgent: Record<string, number> } {
    const one = this.db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT session) s, MAX(at) last FROM observations').get() as Record<string, unknown>;
    const byAgent: Record<string, number> = {};
    for (const r of this.db.prepare('SELECT agent, COUNT(*) n FROM observations GROUP BY agent').all() as Array<Record<string, unknown>>) {
      byAgent[String(r.agent)] = Number(r.n);
    }
    return { observations: Number(one.n), sessions: Number(one.s), last: (one.last as string) ?? null, byAgent };
  }

  close(): void {
    this.db.close();
  }
}
