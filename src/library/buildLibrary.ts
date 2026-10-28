import type { AgentInventory, Library, LibraryMcp, LibrarySkill, McpCopy, Origin, SkillCopy } from './types.ts';

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const groupBy = <T extends { name: string }>(list: T[]) => {
  const out = new Map<string, T[]>();
  for (const it of list) out.set(it.name, [...(out.get(it.name) ?? []), it]);
  return out;
};

/** Per-agent inventories → one book per skill name and one antenna per MCP server name. Pure. */
export function buildLibrary(inventories: Record<string, AgentInventory>): Library {
  const allSkills: SkillCopy[] = Object.values(inventories).flatMap((i) => i.skills);
  const allMcps: McpCopy[] = Object.values(inventories).flatMap((i) => i.mcps);

  const skills: LibrarySkill[] = [...groupBy(allSkills).entries()].map(([name, copies]) => {
    const hashes = new Set(copies.map((c) => c.hash).filter(Boolean));
    return {
      name,
      agents: [...new Set(copies.map((c) => c.agent))].sort(),
      copies,
      divergent: hashes.size > 1,
      origin: mostCommon<Origin>(copies.map((c) => c.origin)),
      plugin: copies.find((c) => c.plugin)?.plugin ?? null,
      tokensApprox: Math.max(...copies.map((c) => c.tokensApprox)),
    };
  });
  // Shared first, then by plugin and name, so shelves read in order.
  skills.sort((a, b) => b.agents.length - a.agents.length || (a.plugin ?? '').localeCompare(b.plugin ?? '') || a.name.localeCompare(b.name));

  const mcps: LibraryMcp[] = [...groupBy(allMcps).entries()].map(([name, copies]) => ({
    name,
    agents: [...new Set(copies.map((c) => c.agent))].sort(),
    copies,
    transport: copies.some((c) => c.transport === 'remote') ? 'remote' : 'local',
    host: copies.find((c) => c.host)?.host ?? null,
  }));
  mcps.sort((a, b) => b.agents.length - a.agents.length || a.name.localeCompare(b.name));

  const agents = Object.entries(inventories)
    .filter(([, i]) => i.skills.length || i.mcps.length)
    .map(([a]) => a);
  return { agents, skills, mcps };
}

/** Shelves of the library: shared books first, then one shelf per agent. */
export function shelvesOf(lib: Library): Array<{ key: string; label: string; skills: LibrarySkill[] }> {
  const shared = lib.skills.filter((s) => s.agents.length > 1);
  const shelves = shared.length ? [{ key: 'shared', label: 'compartilhadas', skills: shared }] : [];
  for (const agent of lib.agents) {
    const own = lib.skills.filter((s) => s.agents.length === 1 && s.agents[0] === agent);
    if (own.length) shelves.push({ key: agent, label: `só ${agent}`, skills: own });
  }
  return shelves;
}
