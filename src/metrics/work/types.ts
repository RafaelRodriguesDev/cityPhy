// What happened in each conversation of a project: title, dates, skills and MCP tools used.
// Names and counts only; message text is never read into the city.

/** One conversation (session) of one agent in one project. */
export interface SessionWork {
  agent: string;
  session: string;
  title: string | null;
  startedAt: string | null;
  lastAt: string | null;
  /** Claude: model calls (API replies); Codex: completed turns. */
  turns: number;
  /** Skill name → times invoked. */
  skills: Record<string, number>;
  /** MCP server (as the agent names it) → tool → calls. */
  mcp: Record<string, Record<string, number>>;
}

/** What one agent's logs can tell for a project. */
export interface AgentWork {
  agent: string;
  sessions: SessionWork[];
  /** False when the agent's logs do not record skill and tool calls (only the list of conversations). */
  toolsRecorded: boolean;
}

/** project name → agents. */
export type WorkReport = Record<string, AgentWork[]>;

/** Skill name as the library knows it: the last part of "plugin:skill". */
export const skillKey = (name: string) => name.split(':').at(-1)!.trim().toLowerCase();

/**
 * MCP server name as configured, from the name an agent logs for it: Claude prefixes plugin servers
 * ("plugin_dotnet-msbuild_binlog" → "binlog"). Unknown servers (built into the app) keep their own name.
 */
export function mcpKey(logged: string, configured: string[]): string {
  const l = logged.toLowerCase();
  return configured.find((c) => l === c.toLowerCase() || l.endsWith(`_${c.toLowerCase()}`)) ?? logged;
}

/** "mcp__server__tool" → [server, tool]; null for any other tool name. */
export function splitMcpTool(name: string): [string, string] | null {
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  return m ? [m[1], m[2]] : null;
}
