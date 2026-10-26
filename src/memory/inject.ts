import type { ProjectOptions } from './schema.ts';

/**
 * Text added to the agent's context at session start: how to use the graph and the memory, plus
 * LESSONS.md. It is the only memory cost paid every session, so it stays within the budget.
 */
export function sessionContext(projectName: string, options: ProjectOptions, lessons: string | null): string {
  const lines = [`[cityPhy] Projeto ${projectName}.`];
  if (options.graph) lines.push(`Antes de ler código, pergunte ao grafo: cityphy query "<pergunta>" --project ${projectName}`);
  if (options.memory) lines.push(`Para lembrar trabalho anterior: cityphy mem search "<termos>" --project ${projectName}`);
  let text = lines.join('\n');
  if (options.inject && lessons) {
    const room = Math.max(0, options.injectBudget * 4 - text.length - 2);
    text += `\n\n${lessons.length > room ? `${lessons.slice(0, room)}…` : lessons}`;
  }
  return text;
}
