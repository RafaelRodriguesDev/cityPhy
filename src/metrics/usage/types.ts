/** Tokens reported by the model API for one model. */
export interface ModelUsage {
  calls: number;
  input: number; // uncached input
  cacheWrite: number; // input written to the prompt cache
  cacheRead: number; // input served from the prompt cache (cheap)
  output: number;
}

/** Where the context that tools brought in came from. */
export type ToolCategory = 'file' | 'search' | 'graph' | 'command' | 'other';

/** Real usage of one agent in one project, read from its own session logs. */
export interface AgentUsage {
  sessions: number;
  models: Record<string, ModelUsage>;
  /** ≈ tokens of tool output per category (what entered the context). */
  tools: Record<ToolCategory, number>;
}
