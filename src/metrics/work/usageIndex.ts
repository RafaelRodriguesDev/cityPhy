// Where each skill and MCP server was used, from the conversations of every project. No DOM, no Three.js.
import { mcpKey, skillKey, type SessionWork, type WorkReport } from './types.ts';

export interface UseSession {
  project: string;
  agent: string;
  session: string;
  title: string | null;
  at: string | null;
  count: number;
}

/** Use of one skill or MCP server across projects. */
export interface Use {
  total: number;
  agents: Record<string, number>;
  projects: Record<string, number>;
  /** MCP only: tool → calls. */
  tools: Record<string, number>;
  /** Most recent first. */
  sessions: UseSession[];
}

export interface UsageIndex {
  skills: Map<string, Use>;
  mcps: Map<string, Use>;
  /** Agents whose logs record skill and tool calls; the others only list their conversations. */
  measured: string[];
  unmeasured: string[];
}

const emptyUse = (): Use => ({ total: 0, agents: {}, projects: {}, tools: {}, sessions: [] });

function add(map: Map<string, Use>, key: string, project: string, s: SessionWork, count: number, tools?: Record<string, number>): void {
  const u = map.get(key) ?? emptyUse();
  map.set(key, u);
  u.total += count;
  u.agents[s.agent] = (u.agents[s.agent] ?? 0) + count;
  u.projects[project] = (u.projects[project] ?? 0) + count;
  for (const [t, n] of Object.entries(tools ?? {})) u.tools[t] = (u.tools[t] ?? 0) + n;
  u.sessions.push({ project, agent: s.agent, session: s.session, title: s.title, at: s.lastAt, count });
}

/**
 * Skill names are matched by their last part ("plugin:skill" → "skill"); MCP servers by the configured
 * name (`mcpNames`), so a plugin server Claude logs as "plugin_x_binlog" counts for "binlog".
 */
export function indexUsage(work: WorkReport, mcpNames: string[]): UsageIndex {
  const skills = new Map<string, Use>();
  const mcps = new Map<string, Use>();
  const measured = new Set<string>();
  const unmeasured = new Set<string>();
  for (const [project, agents] of Object.entries(work)) {
    for (const a of agents) {
      (a.toolsRecorded ? measured : unmeasured).add(a.agent);
      for (const s of a.sessions) {
        for (const [name, n] of Object.entries(s.skills)) add(skills, skillKey(name), project, s, n);
        for (const [server, tools] of Object.entries(s.mcp)) {
          add(mcps, mcpKey(server, mcpNames), project, s, Object.values(tools).reduce((x, y) => x + y, 0), tools);
        }
      }
    }
  }
  for (const u of [...skills.values(), ...mcps.values()]) u.sessions.sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''));
  return { skills, mcps, measured: [...measured], unmeasured: [...unmeasured].filter((a) => !measured.has(a)) };
}

/** Skills and MCP servers used in one project, with counts, busiest first. */
export function projectUse(index: UsageIndex, project: string): { skills: Array<[string, number]>; mcps: Array<[string, number]> } {
  const of = (m: Map<string, Use>) =>
    [...m]
      .map(([k, u]) => [k, u.projects[project] ?? 0] as [string, number])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  return { skills: of(index.skills), mcps: of(index.mcps) };
}
