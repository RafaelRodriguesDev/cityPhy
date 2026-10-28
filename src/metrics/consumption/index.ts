import { antigravityConsumption } from './antigravityConsumption.ts';
import { claudeConsumption } from './claudeConsumption.ts';
import { codexConsumption } from './codexConsumption.ts';
import type { ToolConsumption } from './types.ts';

/**
 * Consumption readers, one per tool (each agent adds its own, like towers). A tool without a
 * reader has no consumption tower instead of a made-up number.
 */
export const CONSUMPTION_READERS: Record<string, (limits: ToolConsumption['limits'], dataDir?: string) => Promise<ToolConsumption>> = {
  claude: claudeConsumption,
  codex: codexConsumption,
  antigravity: antigravityConsumption,
};
