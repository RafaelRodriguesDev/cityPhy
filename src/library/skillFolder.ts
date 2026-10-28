import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileStats, isDir, join, listDir } from '../towers/fileStats.ts';
import type { McpCopy, Origin, SkillCopy } from './types.ts';

type Where = { agent: string; origin: Origin; plugin?: string | null; project?: string | null };

/** One skill folder (with a SKILL.md) as a copy, or null. */
function skillAt(dir: string, name: string, where: Where): SkillCopy | null {
  const file = join(dir, 'SKILL.md');
  const stats = fileStats(file);
  if (!stats) return null;
  let hash = '';
  try {
    hash = createHash('sha1').update(readFileSync(file)).digest('hex');
  } catch {
    // unreadable: counted, never compared
  }
  return {
    name,
    agent: where.agent,
    origin: where.origin,
    plugin: where.plugin ?? null,
    project: where.project ?? null,
    bytes: stats.bytes,
    tokensApprox: Math.round(stats.bytes / 4),
    updatedAt: stats.updatedAt,
    hash,
  };
}

/**
 * Every skill under a skills root: `<root>/<skill>/SKILL.md`. A `synced/<id>/<skill>` folder (skills
 * synced from the agent's account) is read one level deeper, with origin "synced".
 */
export function skillsIn(root: string, where: Where): SkillCopy[] {
  const out: SkillCopy[] = [];
  for (const name of listDir(root)) {
    const dir = join(root, name);
    if (!isDir(dir)) continue;
    const skill = skillAt(dir, name, where);
    if (skill) out.push(skill);
    else if (name === 'synced')
      for (const id of listDir(dir)) for (const s of listDir(join(dir, id))) {
        const synced = skillAt(join(dir, id, s), s, { ...where, origin: 'synced' });
        if (synced) out.push(synced);
      }
  }
  return out;
}

/** MCP servers from a `{ name: { command | url, ... } }` map. Only the name, transport and host are kept. */
export function mcpsFrom(servers: unknown, where: Where & { origin: McpCopy['origin'] }): McpCopy[] {
  if (!servers || typeof servers !== 'object') return [];
  type Server = { url?: unknown; serverUrl?: unknown; httpUrl?: unknown; enabled?: unknown; disabled?: unknown };
  const active = Object.entries(servers as Record<string, Server>).filter(([, s]) => s?.enabled !== false && s?.disabled !== true);
  return active.map(([name, s]) => {
    const url = [s?.url, s?.serverUrl, s?.httpUrl].find((u): u is string => typeof u === 'string');
    let host: string | null = null;
    try {
      host = url ? new URL(url).hostname : null;
    } catch {
      host = null;
    }
    return { name, agent: where.agent, origin: where.origin, plugin: where.plugin ?? null, project: where.project ?? null, transport: url ? 'remote' : 'local', host };
  });
}

/** JSON file, or null when missing or broken. */
export function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
