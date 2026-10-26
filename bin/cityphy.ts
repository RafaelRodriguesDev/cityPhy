#!/usr/bin/env node
// cityPhy command line. Run from anywhere: node <cityPhy>/bin/cityphy.ts <command>
//   setup   [--project P] [--agent A] [--answers k=v,...] [--yes]   requirements, permissions, agent rules
//   refresh [--towers]                                              graphs + towers
//   dev                                                             the city on 127.0.0.1:5190
//   context [--project P]                                           text for the start of a session
//   query "<question>" [--project P] [--agent A] [--budget N]      graphify query + savings metric
//   mem search "<terms>" | mem save --note "<text>" | mem stats | mem lessons | mem import claude   [--project P] [--agent A]
//   hook claude                                                     Claude Code hook (reads the event on stdin)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT, loadConfig } from '../src/config/loadConfig.ts';
import { runClaudeHook } from '../src/cli/hookCommand.ts';
import { memCommand } from '../src/cli/memCommand.ts';
import { flag, positional, resolveProject } from '../src/cli/args.ts';
import { sessionContext } from '../src/memory/inject.ts';
import { readLessons } from '../src/memory/lessons.ts';
import { readOptions } from '../src/memory/options.ts';
import { groupMembers, projectDir, projectGraph } from '../src/memory/paths.ts';
import { loggedQuery } from '../src/metrics/queryLog.ts';
import { setupCommand } from '../src/setup/setupCommand.ts';

const [command, ...rest] = process.argv.slice(2);
const config = loadConfig();

function node(script: string, args: string[]): number {
  return spawnSync(process.execPath, [join(REPO_ROOT, script), ...args], { stdio: 'inherit', cwd: REPO_ROOT }).status ?? 1;
}

// Expected problems (e.g. a folder that is not a cityPhy project) print one clear line, not a stack trace.
process.on('uncaughtException', (e) => {
  console.error(`[cityphy] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});

switch (command) {
  case 'setup':
    process.exitCode = await setupCommand(config, rest);
    break;
  case 'refresh':
    process.exitCode = node('scripts/refresh.ts', rest);
    break;
  case 'dev':
    process.exitCode = spawnSync('npm', ['run', 'dev'], { stdio: 'inherit', cwd: REPO_ROOT, shell: process.platform === 'win32' }).status ?? 1;
    break;
  case 'context': {
    const project = resolveProject(config, rest);
    const dir = projectDir(config, project);
    console.log(sessionContext(project.name, readOptions(dir), readLessons(dir)));
    break;
  }
  case 'query': {
    const question = positional(rest);
    if (!question) throw new Error('uso: cityphy query "<pergunta>" [--project P]');
    const project = resolveProject(config, rest);
    const members = groupMembers(config, project);
    if (members.length) {
      // A group root has no graph of its own: each system has one.
      throw new Error(`${project.name} é um grupo; escolha o sistema: ${members.map((m) => `--project ${m.name}`).join(' | ')}`);
    }
    const budget = Number(flag(rest, '--budget') ?? 2000);
    console.log(loggedQuery(project, projectGraph(config, project), projectDir(config, project), question, flag(rest, '--agent') ?? 'desconhecido', budget));
    break;
  }
  case 'mem':
    await memCommand(config, rest);
    break;
  case 'hook':
    if (rest[0] === 'claude') await runClaudeHook(config);
    break;
  default:
    console.log('comandos: setup | refresh | dev | context | query | mem | hook (veja o topo de bin/cityphy.ts)');
}
