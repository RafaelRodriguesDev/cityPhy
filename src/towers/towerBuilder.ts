import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  SECTIONS,
  SECTION_NAMES,
  type FloorData,
  type Section,
  type TowerGraph,
  type TowerNode,
  type TowerRelation,
} from './schema.ts';

export interface FloorInput {
  id: string;
  label: string;
  section: Section;
  load: FloorData['load'];
  sourceFile: string;
  bytes: number | null;
  updatedAt?: string | null;
  project?: string | null;
}

/** Collects floors and cables of one agent tower and writes the graph.json. */
export class TowerBuilder {
  private readonly nodes = new Map<string, TowerNode>();
  private readonly links: TowerGraph['links'] = [];
  // Plain fields (no parameter properties): the generators run with Node's type stripping.
  private readonly agent: string;
  private readonly agentName: string;
  private readonly recentSessions: number;

  constructor(agent: string, agentName: string, recentSessions = 8) {
    this.agent = agent;
    this.agentName = agentName;
    this.recentSessions = recentSessions;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  addFloor(f: FloorInput): void {
    const community = SECTIONS.indexOf(f.section);
    this.nodes.set(f.id, {
      id: f.id,
      label: f.label,
      community,
      community_name: SECTION_NAMES[f.section],
      file_type: 'document',
      source_file: f.sourceFile,
      source_location: 'L1',
      cityphy: {
        section: f.section,
        load: f.load,
        bytes: f.bytes,
        tokensApprox: f.bytes === null ? null : Math.round(f.bytes / 4),
        updatedAt: f.updatedAt ?? null,
        project: f.project ?? null,
        annex: false,
      },
    });
  }

  link(source: string, target: string, relation: TowerRelation): void {
    if (!this.nodes.has(source) || !this.nodes.has(target) || source === target) return;
    if (this.links.some((l) => l.source === source && l.target === target)) return;
    this.links.push({ source, target, relation, confidence: 'EXTRACTED', weight: 1 });
  }

  /** Only the most recent sessions stay on the tower; older ones move to the annex. */
  private assignAnnex(nodes: TowerNode[]): void {
    const sessions = nodes
      .filter((n) => n.cityphy.section === 'sessions')
      .sort((a, b) => (b.cityphy.updatedAt ?? '').localeCompare(a.cityphy.updatedAt ?? ''));
    for (const n of sessions.slice(this.recentSessions)) n.cityphy.annex = true;
  }

  build(): TowerGraph {
    const nodes = [...this.nodes.values()];
    this.assignAnnex(nodes);
    return {
      directed: true,
      multigraph: false,
      graph: {
        schema_version: 1,
        cityphy: {
          kind: 'agent-tower',
          schemaVersion: 1,
          agent: this.agent,
          agentName: this.agentName,
          generatedAt: new Date().toISOString(),
          recentSessions: this.recentSessions,
        },
      },
      nodes,
      links: this.links,
      hyperedges: [],
    };
  }

  /** Writes <outDir>/graphify-out/graph.json, the same layout graphify uses. */
  write(outDir: string): string {
    const path = `${outDir}/graphify-out/graph.json`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(this.build(), null, 2), 'utf8');
    return path;
  }
}
