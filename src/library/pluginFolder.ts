import { fileStats, isDir, join, listDir } from '../towers/fileStats.ts';
import { mcpsFrom, readJson, skillsIn } from './skillFolder.ts';
import type { AgentInventory } from './types.ts';

/**
 * Skills and MCP servers an installed plugin brings. Reads the first manifest found (`manifests`,
 * relative to the plugin folder), its `skills` roots (default `skills/`) and its MCP servers
 * (`mcpServers` in the manifest, or `.mcp.json`).
 */
export function pluginInventory(dir: string, plugin: string, agent: string, manifests: string[]): AgentInventory {
  const manifest = manifests.map((m) => readJson(join(dir, m))).find(Boolean) ?? {};
  const roots = Array.isArray(manifest.skills) ? (manifest.skills as unknown[]).filter((s): s is string => typeof s === 'string') : ['skills'];
  const skills = roots.flatMap((r) => skillsIn(join(dir, r), { agent, origin: 'plugin', plugin }));
  // `mcpServers` is either the map itself or a path to a file holding it.
  const declared = manifest.mcpServers;
  const servers = typeof declared === 'object' ? declared : readJson(join(dir, typeof declared === 'string' ? declared : '.mcp.json'))?.mcpServers;
  return { skills, mcps: mcpsFrom(servers, { agent, origin: 'plugin', plugin }) };
}

/** Newest version folder of a plugin cache entry (`<cache>/<plugin>/<version>`), by date. */
export function latestVersion(pluginDir: string): string | null {
  const versions = listDir(pluginDir)
    .map((v) => join(pluginDir, v))
    .filter(isDir)
    .map((p) => ({ p, at: fileStats(join(p, 'plugin.json'))?.updatedAt ?? '' }));
  versions.sort((a, b) => (a.at < b.at ? 1 : -1));
  return versions[0]?.p ?? null;
}
