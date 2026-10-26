import type { CityphyConfig, ProjectConfig } from '../config/loadConfig.ts';
import { findProject } from '../memory/paths.ts';

/** Value after `name` (e.g. --project my-app). */
export function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

/** First argument that is neither a flag nor a flag's value. */
export function positional(args: string[], skip = 0): string | undefined {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (!['--yes', '--towers'].includes(args[i])) i++;
      continue;
    }
    values.push(args[i]);
  }
  return values[skip];
}

/** --project, else the configured project that contains the current folder. */
export function resolveProject(config: CityphyConfig, args: string[]): ProjectConfig {
  const wanted = flag(args, '--project') ?? process.cwd();
  const project = findProject(config, wanted);
  if (!project) throw new Error(`projeto não encontrado no cityphy.config.json: ${wanted}`);
  return project;
}
