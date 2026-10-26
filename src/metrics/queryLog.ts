import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '../config/loadConfig.ts';
import { runGraphify } from './graphifyBin.ts';

export interface QueryRecord {
  at: string;
  agent: string;
  question: string;
  /** ≈ tokens the answer put into the agent's context. */
  returned: number;
  /** ≈ tokens of the whole source files behind the answer (what reading them would have cost). */
  avoided: number;
  files: number;
}

/** Source files named in a graphify query answer (`src=path`), unique. */
export function sourceFilesOf(answer: string): string[] {
  return [...new Set([...answer.matchAll(/src=([^\s\]]+)/g)].map((m) => m[1]).filter((f) => f.length > 0))];
}

/** ≈ tokens of the files on disk (bytes / 4); files that no longer exist count as zero. */
export function fileTokens(root: string, files: string[]): number {
  let bytes = 0;
  for (const f of files) {
    try {
      bytes += statSync(join(root, f)).size;
    } catch {
      // moved or deleted since the graph was built
    }
  }
  return Math.round(bytes / 4);
}

/** graphify query + one line in `metrics.jsonl` saying how much reading was avoided. */
export function loggedQuery(project: ProjectConfig, graph: string, dir: string, question: string, agent: string, budget = 2000): string {
  const { out } = runGraphify(['query', question, '--graph', graph, '--budget', String(budget)]);
  const files = sourceFilesOf(out);
  const record: QueryRecord = {
    at: new Date().toISOString(),
    agent,
    question: question.slice(0, 200),
    returned: Math.round(out.length / 4),
    avoided: fileTokens(project.path, files),
    files: files.length,
  };
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'metrics.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
  return out;
}
