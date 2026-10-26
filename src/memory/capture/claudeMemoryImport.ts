import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '../../config/loadConfig.ts';
import { readText } from '../../towers/fileStats.ts';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';
import type { MemoryStore } from '../store.ts';

const SESSION = 'claude-memoria';

/**
 * Brings Claude Code's own memory files of the project into the shared project memory, one note
 * per file (name + description), so the other agents can find them too. Files already imported
 * are replaced, so running it again keeps the notes current.
 */
export function importClaudeMemories(project: ProjectConfig, store: MemoryStore): number {
  const dir = join(claudeHome(), 'projects', projectKey(project.path), 'memory');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
  } catch {
    return 0;
  }
  store.deleteSession(SESSION);
  let n = 0;
  for (const f of files) {
    const text = readText(join(dir, f));
    if (!text) continue;
    const name = /^name:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? f.replace(/\.md$/, '');
    const description = /^description:\s*"?(.+?)"?\s*$/m.exec(text)?.[1]?.trim() ?? '';
    store.add({
      agent: 'claude',
      session: SESSION,
      at: statSync(join(dir, f)).mtime.toISOString(),
      kind: 'note',
      summary: `memória do Claude · ${name}: ${description}`.slice(0, 300),
      files: [],
      tokens: Math.round(text.length / 4),
    });
    n++;
  }
  return n;
}
