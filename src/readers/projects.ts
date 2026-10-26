import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectPart {
  name: string; // top folder of the source files ("neighborhood")
  nodes: number;
  files: number;
}

export interface ProjectSummary {
  name: string;
  root: string; // project path graphify scanned (.graphify_root)
  nodes: number;
  edges: number;
  parts: ProjectPart[];
}

interface RawGraph {
  nodes: Array<{ source_file?: string }>;
  links: unknown[];
}

const MAX_PARTS = 6;
const cache = new Map<string, { mtime: number; summary: ProjectSummary }>();

/** Neighborhood of a node: first folder of its source file. */
function partOf(sourceFile: string): string {
  const i = sourceFile.indexOf('/');
  return i > 0 ? sourceFile.slice(0, i) : '(raiz)';
}

export function summarize(name: string, root: string, graph: RawGraph): ProjectSummary {
  const nodes = new Map<string, number>();
  const files = new Map<string, Set<string>>();
  for (const n of graph.nodes) {
    if (!n.source_file) continue; // external symbols (Task, Guid...) have no file: no building
    const p = partOf(n.source_file);
    nodes.set(p, (nodes.get(p) ?? 0) + 1);
    if (!files.has(p)) files.set(p, new Set());
    files.get(p)!.add(n.source_file);
  }
  const parts = [...nodes.entries()]
    .map(([p, count]) => ({ name: p, nodes: count, files: files.get(p)!.size }))
    .sort((a, b) => b.nodes - a.nodes)
    .slice(0, MAX_PARTS);
  return { name, root, nodes: graph.nodes.length, edges: graph.links.length, parts };
}

/** Every project graph in <dataDir>/<name>/graphify-out/graph.json (towers excluded). Read-only, cached by mtime. */
export function readProjects(dataDir: string): ProjectSummary[] {
  if (!existsSync(dataDir)) return [];
  const out: ProjectSummary[] = [];
  for (const dir of readdirSync(dataDir).filter((d) => !d.startsWith('torre-')).sort()) {
    const base = join(dataDir, dir, 'graphify-out');
    const path = join(base, 'graph.json');
    if (!existsSync(path)) continue;
    const mtime = statSync(path).mtimeMs;
    const hit = cache.get(path);
    if (hit && hit.mtime === mtime) {
      out.push(hit.summary);
      continue;
    }
    try {
      const rootFile = join(base, '.graphify_root');
      const root = existsSync(rootFile) ? readFileSync(rootFile, 'utf8').trim() : dir;
      const summary = summarize(dir, root, JSON.parse(readFileSync(path, 'utf8')) as RawGraph);
      cache.set(path, { mtime, summary });
      out.push(summary);
    } catch {
      // graph being rewritten: skip it this time
    }
  }
  return out;
}
