// What cityPhy saved in a project and how much of the agents' work went through it. No Three.js, no DOM.
import type { ProjectExtras } from '../readers/projectExtras.ts';
import type { ProjectSummary } from '../readers/projects.ts';
import type { UsageReport } from '../readers/usage.ts';
import type { ProjectControl } from '../readers/control.ts';
import { emptyTools, type ToolCategory } from '../metrics/usage/types.ts';

export type Project = ProjectSummary & { cityphy: ProjectExtras; group?: { name: string; path: string } };

/** One agent in one project: sessions in its own logs vs sessions cityPhy saw. */
export interface AgentControl {
  agent: string;
  /** Sessions in the agent's own logs for this project. */
  logSessions: number;
  /** Captured live by the cityPhy hooks ("incluída agora"). */
  live: number;
  /** Brought in later from old logs (`mem import`, "controle antigo"). */
  imported: number;
  /** Sessions cityPhy never saw. */
  outside: number;
  firstLive: string | null;
  /** ≈ tokens that entered the conversation through tools, per kind. */
  tools: Record<ToolCategory, number>;
  /** Graph queries logged with their savings. */
  queries: number;
  saved: number;
  status: 'live' | 'history' | 'outside';
}

export interface ProjectEconomy {
  /** What reading the whole files would have cost. */
  avoided: number;
  /** What the graph answers actually put in the context. */
  returned: number;
  saved: number;
  queries: number;
  /** Share of the tool tokens that came from the graph (0..1), null with no tool data. */
  graphShare: number | null;
  /** Summary injected at session start (paid every session) and LESSONS.md size. */
  inject: { on: boolean; budget: number; lessons: number | null };
  agents: AgentControl[];
}

const sum = (t: Record<ToolCategory, number>) => Object.values(t).reduce((a, b) => a + b, 0);

export function economyOf(p: Project, usage: UsageReport, control: ProjectControl): ProjectEconomy {
  const s = p.cityphy.savings;
  const keys = [p.name, p.group?.name].filter((k): k is string => !!k);
  const names = new Set([...Object.keys(usage.agents).filter((a) => keys.some((k) => usage.agents[a].projects[k])), ...Object.keys(control)]);
  const agents = [...names].map((agent): AgentControl => {
    const u = keys.map((k) => usage.agents[agent]?.projects[k]).find(Boolean);
    const c = control[agent] ?? { imported: 0, live: 0, firstLive: null };
    const logSessions = u?.sessions ?? 0;
    const tools = u?.tools ?? emptyTools();
    const by = s.byAgent[agent] ?? { queries: 0, saved: 0 };
    return {
      agent,
      logSessions,
      live: c.live,
      imported: c.imported,
      outside: Math.max(0, logSessions - c.live - c.imported),
      firstLive: c.firstLive,
      tools,
      queries: by.queries,
      saved: by.saved,
      status: c.live ? 'live' : c.imported ? 'history' : 'outside',
    };
  });
  agents.sort((a, b) => b.logSessions - a.logSessions);
  const tools = agents.reduce((t, a) => t + sum(a.tools), 0);
  const graph = agents.reduce((t, a) => t + a.tools.graph, 0);
  const o = p.cityphy.options;
  return {
    avoided: s.avoided,
    returned: s.returned,
    saved: s.saved,
    queries: s.queries,
    graphShare: tools ? graph / tools : null,
    inject: { on: o.inject, budget: o.injectBudget, lessons: p.cityphy.lessonsTokens },
    agents,
  };
}
