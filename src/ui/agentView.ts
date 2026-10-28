import type { Library } from '../library/types.ts';
import type { ToolConsumption } from '../metrics/consumption/types.ts';
import type { ModelBreakdown } from '../metrics/usage/types.ts';
import type { TowerGraph } from '../towers/schema.ts';

/** One color per agent, kept apart from the project colors (those are on the cables). */
export const AGENT_COLOR: Record<string, number> = { claude: 0xd97757, codex: 0xb8c4d6, antigravity: 0x5b8def };
export const agentColor = (a: string) => AGENT_COLOR[a] ?? 0x9aa4b2;

/** Everything the sidebar, the HUD and the agent panel know about one agent. */
export interface AgentView {
  agent: string;
  name: string;
  tower: TowerGraph | null;
  consumption: ToolConsumption | null;
  models: ModelBreakdown[];
  powers: string[]; // projects it ever worked on
  lastActive: string | null; // latest log write in any project
  activeNow: boolean;
}

/** Ground floor: what this agent loads in every session (known tokens + floors not measured). */
export function groundOf(tower: TowerGraph | null): { tokens: number; unknown: number; floors: TowerGraph['nodes'] } {
  const floors = tower?.nodes.filter((n) => n.cityphy.load === 'always') ?? [];
  return {
    tokens: floors.reduce((s, n) => s + (n.cityphy.tokensApprox ?? 0), 0),
    unknown: floors.filter((n) => n.cityphy.tokensApprox === null).length,
    floors,
  };
}

export const skillsOf = (lib: Library, agent: string) => lib.skills.filter((s) => s.agents.includes(agent));
export const mcpsOf = (lib: Library, agent: string) => lib.mcps.filter((m) => m.agents.includes(agent));

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
export const dot = (agent: string) => `<i class="dot" style="background:${hex(agentColor(agent))}"></i>`;
export const swatch = (color: number) => `<i class="dot sq" style="background:${hex(color)}"></i>`;

/** "1,2 mi", "830 mil", "640". */
export function short(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} mil`;
  return String(n);
}
