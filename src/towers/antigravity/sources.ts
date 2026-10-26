import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProjectConfig } from '../../config/loadConfig.ts';

/** ~/.gemini, or GEMINI_HOME. Everything here is only read. */
export function geminiHome(): string {
  return process.env.GEMINI_HOME ?? join(homedir(), '.gemini');
}

/** Project folder key for stable IDs: "D:\a\b" -> "D--a-b". */
export function projectKey(projectPath: string): string {
  return projectPath.replace(/[:\\/]/g, '-');
}

export interface AntigravityProjectSources {
  name: string;
  path: string;
  key: string;
  agentsSkillsDir: string;
}

export function projectSources(project: ProjectConfig): AntigravityProjectSources {
  const key = projectKey(project.path);
  return {
    name: project.name,
    path: project.path,
    key,
    agentsSkillsDir: join(project.path, '.agents', 'skills'),
  };
}
