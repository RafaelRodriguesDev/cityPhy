import type { CityphyConfig } from '../config/loadConfig.ts';
import { importClaudeSessions } from '../memory/capture/claudeImport.ts';
import { importClaudeMemories } from '../memory/capture/claudeMemoryImport.ts';
import { refreshLessons } from '../memory/lessons.ts';
import { readOptions } from '../memory/options.ts';
import { projectDir } from '../memory/paths.ts';
import { MemoryStore } from '../memory/store.ts';
import { flag, positional, resolveProject } from './args.ts';

/** `cityphy mem search|save|stats|lessons|import claude`. */
export async function memCommand(config: CityphyConfig, args: string[]): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);
  const project = resolveProject(config, rest);
  const dir = projectDir(config, project);
  const store = new MemoryStore(dir);
  try {
    switch (sub) {
      case 'search': {
        const terms = positional(rest) ?? '';
        const found = store.search(terms, Number(flag(rest, '--limit') ?? 10));
        if (!found.length) console.log('(nada encontrado)');
        for (const o of found) console.log(`${o.at.slice(0, 16)} ${o.agent} [${o.kind}] ${o.summary}${o.files.length ? ` — ${o.files.join(', ')}` : ''}`);
        break;
      }
      case 'save': {
        const note = flag(rest, '--note');
        if (!note) throw new Error('uso: cityphy mem save --note "<texto>" [--agent A] [--files a,b]');
        const agent = flag(rest, '--agent') ?? 'desconhecido';
        store.add({
          agent,
          session: flag(rest, '--session') ?? `${agent}-${new Date().toISOString().slice(0, 10)}`,
          at: new Date().toISOString(),
          kind: 'note',
          summary: note.replace(/\s+/g, ' ').slice(0, 300),
          files: (flag(rest, '--files') ?? '').split(',').filter(Boolean),
          tokens: null,
        });
        refreshLessons(dir, store, project.name, readOptions(dir).injectBudget);
        console.log('salvo');
        break;
      }
      case 'stats':
        console.log(JSON.stringify(store.stats(), null, 2));
        break;
      case 'lessons':
        console.log(refreshLessons(dir, store, project.name, readOptions(dir).injectBudget));
        break;
      case 'import': {
        if (positional(rest) !== 'claude') throw new Error('uso: cityphy mem import claude [--project P]');
        const s = await importClaudeSessions(project, store);
        const notes = importClaudeMemories(project, store);
        refreshLessons(dir, store, project.name, readOptions(dir).injectBudget);
        console.log(`importado: ${s.sessions} sessão(ões), ${s.observations} observações, ${notes} memória(s) do Claude`);
        break;
      }
      default:
        console.log('uso: cityphy mem search|save|stats|lessons [--project P]');
    }
  } finally {
    store.close();
  }
}
