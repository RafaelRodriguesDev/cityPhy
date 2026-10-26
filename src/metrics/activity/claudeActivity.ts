import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { claudeHome, projectKey } from '../../towers/claude/sources.ts';

/** Last write to any Claude Code session log of this folder (ISO), or null. Only file dates are read. */
export async function claudeActivity(projectPath: string): Promise<string | null> {
  const dir = join(claudeHome(), 'projects', projectKey(projectPath));
  let latest = 0;
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      latest = Math.max(latest, statSync(join(dir, f)).mtimeMs);
    }
  } catch {
    return null;
  }
  return latest ? new Date(latest).toISOString() : null;
}
