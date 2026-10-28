// The civic district's data: every skill and MCP server each agent can use. Names, sizes, dates and
// where they come from only; a skill's text is hashed (to spot diverging copies), never kept.

/** Where a copy of a skill or an MCP server was installed. */
export type Origin = 'user' | 'synced' | 'plugin' | 'project';

/** One copy of a skill, as one agent sees it. */
export interface SkillCopy {
  name: string;
  agent: string;
  origin: Origin;
  plugin: string | null; // plugin that brought it ("dotnet-test")
  project: string | null; // project name, for project skills
  bytes: number;
  tokensApprox: number;
  updatedAt: string;
  hash: string; // of SKILL.md, to tell identical copies from diverging ones
}

/** One MCP server entry, as one agent has it configured. */
export interface McpCopy {
  name: string;
  agent: string;
  origin: Exclude<Origin, 'synced'>;
  plugin: string | null;
  project: string | null;
  transport: 'local' | 'remote';
  host: string | null; // remote only: host name, never the full URL (it may carry tokens)
}

/** A skill name across agents: one book in the library. */
export interface LibrarySkill {
  name: string;
  agents: string[];
  copies: SkillCopy[];
  /** Copies with different text under the same name. */
  divergent: boolean;
  /** Most common origin among the copies (what colors the book). */
  origin: Origin;
  plugin: string | null;
  tokensApprox: number; // largest copy
}

/** An MCP server name across agents: one antenna. */
export interface LibraryMcp {
  name: string;
  agents: string[];
  copies: McpCopy[];
  transport: 'local' | 'remote';
  host: string | null;
}

export interface Library {
  agents: string[]; // agents that have at least one skill or MCP server
  skills: LibrarySkill[];
  mcps: LibraryMcp[];
}

/** What every agent's inventory reader returns. */
export interface AgentInventory {
  skills: SkillCopy[];
  mcps: McpCopy[];
}
