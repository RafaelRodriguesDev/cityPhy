import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Agents cityPhy knows how to configure, and the folder that shows each one is installed. */
export const KNOWN_AGENTS: Array<{ id: string; name: string; home: string }> = [
  { id: 'claude', name: 'Claude Code', home: join(homedir(), '.claude') },
  { id: 'codex', name: 'Codex', home: join(homedir(), '.codex') },
  { id: 'antigravity', name: 'Antigravity', home: join(homedir(), '.gemini') },
];

export function detectAgents(): typeof KNOWN_AGENTS {
  return KNOWN_AGENTS.filter((a) => existsSync(a.home));
}
