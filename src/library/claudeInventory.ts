import { homedir } from 'node:os';
import type { ProjectConfig } from '../config/loadConfig.ts';
import { claudeHome } from '../towers/claude/sources.ts';
import { join } from '../towers/fileStats.ts';
import { pluginInventory } from './pluginFolder.ts';
import { mcpsFrom, readJson, skillsIn } from './skillFolder.ts';
import type { AgentInventory } from './types.ts';

const AGENT = 'claude';
const samePath = (a: string, b: string) => a.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase() === b.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/**
 * Claude Code: user skills (~/.claude/skills, synced ones included), enabled plugins (skills and MCP
 * servers), MCP servers in ~/.claude.json (global and per project) and each project's .claude/skills
 * and .mcp.json. Read-only.
 */
export function claudeInventory(projects: ProjectConfig[]): AgentInventory {
  const home = claudeHome();
  const inv: AgentInventory = { skills: skillsIn(join(home, 'skills'), { agent: AGENT, origin: 'user' }), mcps: [] };

  const enabled = (readJson(join(home, 'settings.json'))?.enabledPlugins ?? {}) as Record<string, boolean>;
  const installed = (readJson(join(home, 'plugins', 'installed_plugins.json'))?.plugins ?? {}) as Record<string, Array<{ installPath?: string }>>;
  for (const [id, installs] of Object.entries(installed)) {
    if (enabled[id] !== true || !installs[0]?.installPath) continue;
    const p = pluginInventory(installs[0].installPath, id.split('@')[0], AGENT, ['.claude-plugin/plugin.json', 'plugin.json']);
    inv.skills.push(...p.skills);
    inv.mcps.push(...p.mcps);
  }

  const state = readJson(process.env.CLAUDE_HOME ? join(home, '.claude.json') : join(homedir(), '.claude.json'));
  inv.mcps.push(...mcpsFrom(state?.mcpServers, { agent: AGENT, origin: 'user' }));
  const perProject = (state?.projects ?? {}) as Record<string, { mcpServers?: unknown }>;
  for (const project of projects) {
    const where = { agent: AGENT, origin: 'project' as const, project: project.name };
    inv.skills.push(...skillsIn(join(project.path, '.claude', 'skills'), where));
    inv.mcps.push(...mcpsFrom(readJson(join(project.path, '.mcp.json'))?.mcpServers, where));
    const key = Object.keys(perProject).find((k) => samePath(k, project.path));
    if (key) inv.mcps.push(...mcpsFrom(perProject[key].mcpServers, where));
  }
  return inv;
}
