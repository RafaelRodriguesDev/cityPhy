import type { CityphyConfig } from '../config/loadConfig.ts';
import { observationFromClaudeHook, type ClaudeHookEvent } from '../memory/capture/claudeHook.ts';
import { sessionContext } from '../memory/inject.ts';
import { readLessons, refreshLessons } from '../memory/lessons.ts';
import { readOptions } from '../memory/options.ts';
import { findProject, projectDir } from '../memory/paths.ts';
import { MemoryStore } from '../memory/store.ts';

async function readStdin(): Promise<string> {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/**
 * `cityphy hook claude`: records the event in the project's memory (when the project opted in) and,
 * at session start, prints the session context (Claude Code adds a SessionStart hook's output to
 * the context). A hook must never break the session, so every error is swallowed.
 */
export async function runClaudeHook(config: CityphyConfig): Promise<void> {
  try {
    const event = JSON.parse(await readStdin()) as ClaudeHookEvent;
    // A file event belongs to the project that holds the file, even when the session runs in another one.
    const file = event.tool_input?.file_path ?? event.tool_input?.notebook_path;
    const project = (typeof file === 'string' ? findProject(config, file) : null) ?? findProject(config, event.cwd ?? process.cwd());
    if (!project) return;
    const dir = projectDir(config, project);
    const options = readOptions(dir);

    if (event.hook_event_name === 'SessionStart' && (options.graph || options.memory || options.inject)) {
      process.stdout.write(sessionContext(project.name, options, readLessons(dir)));
    }
    if (!options.memory) return;

    const store = new MemoryStore(dir);
    try {
      const obs = observationFromClaudeHook(event, project);
      if (obs) store.add(obs);
      if (event.hook_event_name === 'Stop' || event.hook_event_name === 'SessionEnd') {
        refreshLessons(dir, store, project.name, options.injectBudget);
      }
    } finally {
      store.close();
    }
  } catch {
    // never block the agent
  }
}
