import { geminiHome } from '../towers/antigravity/sources.ts';
import { join } from '../towers/fileStats.ts';
import { mcpsFrom, readJson, skillsIn } from './skillFolder.ts';
import type { AgentInventory } from './types.ts';

const AGENT = 'antigravity';

/** Antigravity: ~/.gemini/config/skills, extra skill roots in skills.json and MCP servers in mcp_config.json. Read-only. */
export function antigravityInventory(): AgentInventory {
  const config = join(geminiHome(), 'config');
  const extra = ((readJson(join(config, 'skills.json'))?.entries ?? []) as Array<{ path?: unknown }>)
    .map((e) => e.path)
    .filter((p): p is string => typeof p === 'string');
  const skills = [join(config, 'skills'), ...extra].flatMap((root) => skillsIn(root, { agent: AGENT, origin: 'user' }));
  return { skills, mcps: mcpsFrom(readJson(join(config, 'mcp_config.json'))?.mcpServers, { agent: AGENT, origin: 'user' }) };
}
