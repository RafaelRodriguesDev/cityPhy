// Agent tower model. A tower is a graphify-compatible graph.json: graphify can query it,
// and cityPhy draws it. Every node is one floor; extra data lives under `cityphy`.

export const SECTIONS = ['ground', 'memory', 'skills', 'sessions'] as const;
export type Section = (typeof SECTIONS)[number];

/** How the content reaches the agent's context. */
export type Load =
  | 'always' // loaded in every session (paid every time)
  | 'on-demand' // stored; read only when the agent opens it
  | 'history'; // past sessions; not loaded, kept as a log

export const SECTION_NAMES: Record<Section, string> = {
  ground: 'Térreo (sempre carregado)',
  memory: 'Memória',
  skills: 'Skills',
  sessions: 'Sessões',
};

export interface FloorData {
  section: Section;
  load: Load;
  /** File size in bytes, or null when the content is not a file (e.g. built-in rules). */
  bytes: number | null;
  /** Rough token estimate (bytes / 4), or null when unknown. */
  tokensApprox: number | null;
  /** ISO date of the last change, when known. */
  updatedAt: string | null;
  /** Project the floor belongs to, when it is project-specific. */
  project: string | null;
  /** True when the floor was moved to the annex (tower height limit). */
  annex: boolean;
}

export interface TowerNode {
  id: string;
  label: string;
  community: number;
  community_name: string;
  file_type: 'document';
  source_file: string;
  source_location: string;
  cityphy: FloorData;
}

export type TowerRelation =
  | 'indexes' // an index file points to an entry (MEMORY.md -> memory)
  | 'links_to' // an entry links another ([[name]])
  | 'lists' // a listing that is always loaded names the entry (skills list -> SKILL.md)
  | 'loads'; // the ground floor brings this into every session

export interface TowerLink {
  source: string;
  target: string;
  relation: TowerRelation;
  confidence: 'EXTRACTED';
  weight: number;
}

export interface TowerGraph {
  directed: true;
  multigraph: false;
  graph: {
    schema_version: 1;
    cityphy: {
      kind: 'agent-tower';
      schemaVersion: 1;
      agent: string;
      agentName: string;
      generatedAt: string;
      /** The tower keeps this many recent sessions on top; older ones go to the annex. */
      recentSessions: number;
    };
  };
  nodes: TowerNode[];
  links: TowerLink[];
  hyperedges: [];
}
