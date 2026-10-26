import { spawnSync } from 'node:child_process';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { flag } from '../cli/args.ts';
import { readOptions, writeOptions } from '../memory/options.ts';
import { findProject, projectDir } from '../memory/paths.ts';
import { writeClaudeHooks, writeRulesBlock } from './agentRules.ts';
import { createAsker, parseAnswers } from './askUser.ts';
import { detectAgents } from './detectAgents.ts';
import { checkRequirements } from './requirements.ts';

/**
 * `cityphy setup`: 1) requirements (installs only with permission), 2) per project, the opt-in
 * questions, 3) the agent's rules (AGENTS.md block; Claude also gets hooks), each write asked first.
 */
export async function setupCommand(config: CityphyConfig, args: string[]): Promise<number> {
  const asker = createAsker(parseAnswers(flag(args, '--answers')), args.includes('--yes'));
  try {
    console.log('\n== Requisitos ==');
    for (const r of checkRequirements()) {
      console.log(`${r.found ? 'ok ' : r.required ? 'FALTA' : 'opcional'}  ${r.name}${r.found ? ` (${r.found})` : ''} — ${r.why}`);
      if (r.found) continue;
      if (r.install && (await asker.yesNo(`   Instalar ${r.name} com "${r.install.command} ${r.install.args.join(' ')}"?`, false, `install:${r.name}`))) {
        const ok = spawnSync(r.install.command, r.install.args, { stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;
        console.log(ok ? '   instalado' : '   falhou: instale manualmente');
      } else if (r.manual) {
        console.log(`   instale manualmente: ${r.manual}`);
      }
    }

    const wanted = flag(args, '--project');
    const projects = wanted ? [findProject(config, wanted)].filter((p) => p !== null) : config.projects;
    if (!projects.length) {
      console.log('\nNenhum projeto: edite o cityphy.config.json (veja cityphy.config.example.json).');
      return 1;
    }
    const agent = flag(args, '--agent');
    const agents = agent ? [agent] : detectAgents().map((a) => a.id);

    for (const project of projects) {
      console.log(`\n== Projeto ${project.name} (${project.path}) ==`);
      const dir = projectDir(config, project);
      const o = readOptions(dir);
      o.graph = await asker.yesNo('Usar o grafo do graphify neste projeto? (recomendado)', true, 'graph');
      o.memory = await asker.yesNo('Ligar a memória automática local (nada sai da máquina)?', true, 'memory');
      o.inject = await asker.yesNo('Colocar um resumo do trabalho recente no início de cada sessão?', true, 'inject');
      if (o.inject) o.injectBudget = await asker.number('Teto desse resumo, em tokens?', o.injectBudget, 'budget');
      o.metrics = await asker.yesNo('Registrar a economia de tokens de cada consulta ao grafo?', true, 'metrics');
      o.localLlm = await asker.yesNo('Usar uma IA local (Ollama) para resumos? (ainda não usado)', false, 'localLlm');
      o.agents = [...new Set([...o.agents, ...agents])];
      writeOptions(dir, o);
      console.log(`   opções salvas em ${dir}`);

      if (await asker.yesNo(`Posso escrever o bloco do cityPhy no AGENTS.md de ${project.name}?`, false, 'rules')) {
        console.log(`   ${writeRulesBlock(project)}`);
      }
      if (agents.includes('claude') && o.memory && (await asker.yesNo(`Posso ligar os hooks do Claude Code em ${project.name}/.claude/settings.local.json?`, false, 'hooks'))) {
        console.log(`   ${writeClaudeHooks(project)}`);
      }
    }
    console.log('\nPronto. Rode "cityphy refresh" e depois "cityphy dev".');
    return 0;
  } finally {
    asker.close();
  }
}
