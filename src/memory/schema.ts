// Local project memory (the claude-mem idea, kept on disk and summarized by rules, never by a remote model).

export type ObservationKind =
  | 'session-start'
  | 'prompt' // what the person asked
  | 'read' // file read
  | 'edit' // file written or edited
  | 'command' // shell command
  | 'search' // grep/glob
  | 'graph-query' // graphify / cityphy query
  | 'note' // saved on purpose by an agent
  | 'session-end';

export interface Observation {
  id?: number;
  agent: string;
  session: string;
  at: string; // ISO date
  kind: ObservationKind;
  summary: string; // one short line, built by rules
  files: string[]; // project files involved (links to graph nodes)
  tokens: number | null; // ≈ tokens that entered the agent's context with it
}

/** What a project opted into (`<dataDir>/<project>/cityphy/project.json`). */
export interface ProjectOptions {
  graph: boolean; // agents query the graphify graph before reading code
  memory: boolean; // automatic local capture
  inject: boolean; // short summary at session start
  injectBudget: number; // ≈ tokens of that summary
  metrics: boolean; // log savings of each graph query
  localLlm: boolean; // optional local model for nicer summaries (not used yet)
  agents: string[]; // agents that answered the setup questions for this project
}

export const DEFAULT_OPTIONS: ProjectOptions = {
  graph: false,
  memory: false,
  inject: false,
  injectBudget: 800,
  metrics: false,
  localLlm: false,
  agents: [],
};
