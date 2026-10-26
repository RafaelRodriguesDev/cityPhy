import { antigravityUsage } from './antigravityUsage.ts';
import { claudeUsage } from './claudeUsage.ts';
import { codexUsage } from './codexUsage.ts';
import type { AgentUsage } from './types.ts';

/**
 * Real-usage readers, one per agent (each agent adds its own, like towers). An agent without a
 * reader shows "sem dados" in the city instead of a made-up number.
 */
export const USAGE_READERS: Record<string, (projectPath: string) => Promise<AgentUsage>> = {
  claude: claudeUsage,
  codex: codexUsage,
  antigravity: antigravityUsage,
};
