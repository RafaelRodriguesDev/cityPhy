import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ProjectConfig } from '../../config/loadConfig.ts';

/** ~/.claude, or CLAUDE_HOME. Everything here is only read. */
export function claudeHome(): string {
  return process.env.CLAUDE_HOME ?? join(homedir(), '.claude');
}

/** Where Claude Code keeps what belongs to one project. */
export interface ClaudeProjectSources {
  name: string; // project name from the config
  path: string; // project folder
  key: string; // ~/.claude/projects/<key>
  data: string; // sessions (*.jsonl) live here
  memoryDir: string;
}

/** Claude Code names a project's folder after its path: "D:\a\b" -> "D--a-b". */
export function projectKey(projectPath: string): string {
  return projectPath.replace(/[:\\/]/g, '-');
}

export function projectSources(home: string, project: ProjectConfig): ClaudeProjectSources {
  const key = projectKey(project.path);
  const data = join(home, 'projects', key);
  return { name: project.name, path: project.path, key, data, memoryDir: join(data, 'memory') };
}
