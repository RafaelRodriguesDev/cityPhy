import { join } from 'node:path';
import { loadConfig, type ProjectConfig } from '../config/loadConfig.ts';

export interface TowerArgs {
  /** Projects the tower covers: --project <path> (repeatable), else every project in the config. */
  projects: ProjectConfig[];
  /** Output folder: --out <dir>, else <dataDir>/torre-<agent>. */
  out: string;
}

/** Shared command line of every tower generator: `node src/towers/<agent>/build<Agent>Tower.ts [--project p] [--out d]`. */
export function towerArgs(agent: string, argv = process.argv): TowerArgs {
  const config = loadConfig();
  const picked: string[] = [];
  let out: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--project' && argv[i + 1]) picked.push(argv[++i]);
    else if (argv[i] === '--out' && argv[i + 1]) out = argv[++i];
  }
  const projects = picked.length
    ? picked.map((p) => config.projects.find((c) => samePath(c.path, p)) ?? { name: p.split(/[\\/]/).pop() ?? p, path: p })
    : config.projects;
  return { projects, out: out ?? join(config.dataDir, `torre-${agent}`) };
}

export function samePath(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
  return n(a) === n(b);
}
