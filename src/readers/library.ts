import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { agentWorkspaces } from '../config/groups.ts';
import { antigravityInventory } from '../library/antigravityInventory.ts';
import { buildLibrary } from '../library/buildLibrary.ts';
import { claudeInventory } from '../library/claudeInventory.ts';
import { codexInventory } from '../library/codexInventory.ts';
import type { Library } from '../library/types.ts';

/** Skills and MCP servers of every agent, merged into the civic district. Read-only. */
export function readLibrary(config: CityphyConfig): Library {
  return buildLibrary({
    claude: claudeInventory(agentWorkspaces(config.projects)),
    codex: codexInventory(),
    antigravity: antigravityInventory(),
  });
}

/** The fictional example ships its library as a file (examples/data/library.json). */
export function readExampleLibrary(dataDir: string): Library {
  const path = join(dataDir, 'library.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { agents: [], skills: [], mcps: [] };
}
