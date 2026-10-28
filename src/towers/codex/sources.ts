import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProjectConfig } from '../../config/loadConfig.ts';

/** ~/.codex, or CODEX_HOME. Everything here is only read. */
export function codexHome(): string {
  return process.env.CODEX_HOME ?? join(homedir(), '.codex');
}

/** Stable project key: "D:\\a\\b" -> "D--a-b". */
export function projectKey(projectPath: string): string {
  return projectPath.replace(/[:\\/]/g, '-');
}

export interface CodexProjectSources {
  name: string;
  path: string;
  key: string;
  codexSkillsDir: string;
  agentsSkillsDir: string;
}

export function projectSources(project: ProjectConfig): CodexProjectSources {
  return {
    name: project.name,
    path: project.path,
    key: projectKey(project.path),
    codexSkillsDir: join(project.path, '.codex', 'skills'),
    agentsSkillsDir: join(project.path, '.agents', 'skills'),
  };
}

