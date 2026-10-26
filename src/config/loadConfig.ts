import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ProjectConfig {
  /** Name shown in the city and folder name under dataDir. */
  name: string;
  /** Project root on disk. */
  path: string;
  /** graphify --exclude patterns. */
  exclude?: string[];
}

export interface CityphyConfig {
  /** Holds <project>/graphify-out and torre-<agent>/graphify-out. */
  dataDir: string;
  projects: ProjectConfig[];
  /** Full path to graphify when it is not on PATH (GRAPHIFY_BIN overrides it). */
  graphifyBin?: string;
  /** Relative cost of each model in your plan (1 = 1x, 2 = 2x, 0 = free). Models left out show "não informado". */
  models?: Record<string, { multiplier?: number }>;
  /** Your own limits per tool, in fresh tokens, for the consumption tower (left out = "limite não definido"). */
  tools?: Record<string, { dailyLimit?: number; weeklyLimit?: number }>;
}

/** cityPhy's own folder (two levels above this file), where cityphy.config.json lives. */
export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

/**
 * Reads cityphy.config.json (CITYPHY_CONFIG, else the repo root), so agents can run cityPhy commands
 * from any project folder. Relative paths resolve against the config file. CITYPHY_DATA overrides
 * dataDir. Missing file: an empty city with ./data.
 */
export function loadConfig(): CityphyConfig {
  const file = resolve(process.env.CITYPHY_CONFIG ?? resolve(REPO_ROOT, 'cityphy.config.json'));
  const base = dirname(file);
  const raw: Partial<CityphyConfig> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const dataDir = resolve(base, process.env.CITYPHY_DATA ?? raw.dataDir ?? './data');
  const projects = (raw.projects ?? []).map((p) => ({ ...p, path: resolve(base, p.path) }));
  return { dataDir, projects, graphifyBin: raw.graphifyBin, models: raw.models ?? {}, tools: raw.tools ?? {} };
}
