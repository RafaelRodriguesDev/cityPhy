import { codexHome } from '../towers/codex/sources.ts';
import { join, readText } from '../towers/fileStats.ts';
import { latestVersion, pluginInventory } from './pluginFolder.ts';
import { mcpsFrom, skillsIn } from './skillFolder.ts';
import type { AgentInventory } from './types.ts';

const AGENT = 'codex';

/**
 * The parts of ~/.codex/config.toml the library needs: enabled plugins (`[plugins."name@market"]`
 * with `enabled = true`) and MCP servers (`[mcp_servers.name]`, remote when it has a `url`).
 * Values other than `enabled` and `url` are never read.
 */
export function parseCodexConfig(toml: string): { plugins: string[]; servers: Record<string, { url?: string }> } {
  const plugins: string[] = [];
  const servers: Record<string, { url?: string }> = {};
  let section: { kind: 'plugin' | 'mcp'; name: string } | null = null;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.trim();
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      const plugin = header[1].match(/^plugins\."([^"]+)"$/);
      const mcp = header[1].match(/^mcp_servers\.("?)([^".]+)\1$/);
      section = plugin ? { kind: 'plugin', name: plugin[1] } : mcp ? { kind: 'mcp', name: mcp[2] } : null;
      if (section?.kind === 'mcp') servers[section.name] ??= {};
      continue;
    }
    if (section?.kind === 'plugin' && /^enabled\s*=\s*true\b/.test(line)) plugins.push(section.name);
    const url = section?.kind === 'mcp' ? line.match(/^url\s*=\s*"([^"]+)"/) : null;
    if (url && section) servers[section.name].url = url[1];
  }
  return { plugins, servers };
}

/** Codex: ~/.codex/skills, enabled plugins from its cache (skills and MCP servers) and MCP servers in config.toml. Read-only. */
export function codexInventory(): AgentInventory {
  const home = codexHome();
  const inv: AgentInventory = { skills: skillsIn(join(home, 'skills'), { agent: AGENT, origin: 'user' }), mcps: [] };
  const config = parseCodexConfig(readText(join(home, 'config.toml')) ?? '');
  inv.mcps.push(...mcpsFrom(config.servers, { agent: AGENT, origin: 'user' }));
  for (const id of config.plugins) {
    const [name, market] = id.split('@');
    const dir = latestVersion(join(home, 'plugins', 'cache', market ?? '', name));
    if (!dir) continue;
    const p = pluginInventory(dir, name, AGENT, ['.codex-plugin/plugin.json', 'plugin.json']);
    inv.skills.push(...p.skills);
    inv.mcps.push(...p.mcps);
  }
  return inv;
}
