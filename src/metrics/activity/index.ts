import { antigravityActivity } from './antigravityActivity.ts';
import { claudeActivity } from './claudeActivity.ts';
import { codexActivity } from './codexActivity.ts';

/**
 * "When did this tool last work in this folder?", one reader per tool (each agent adds its own).
 * Only log file dates are read, so the page can ask every few seconds.
 */
export const ACTIVITY_READERS: Record<string, (projectPath: string) => Promise<string | null>> = {
  claude: claudeActivity,
  codex: codexActivity,
  antigravity: antigravityActivity,
};
