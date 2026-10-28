import { describe, expect, it } from 'vitest';
import { buildLibrary, shelvesOf } from '../src/library/buildLibrary.ts';
import { parseCodexConfig } from '../src/library/codexInventory.ts';
import type { SkillCopy } from '../src/library/types.ts';
import { blockValues } from '../src/scene/consumptionTower.ts';
import type { ToolConsumption } from '../src/metrics/consumption/types.ts';

const skill = (name: string, agent: string, hash: string, origin: SkillCopy['origin'] = 'user'): SkillCopy => ({
  name,
  agent,
  origin,
  plugin: null,
  project: null,
  bytes: 400,
  tokensApprox: 100,
  updatedAt: '2026-01-01T00:00:00.000Z',
  hash,
});

describe('library', () => {
  const lib = buildLibrary({
    claude: { skills: [skill('graph', 'claude', 'a'), skill('docs', 'claude', 'b')], mcps: [] },
    codex: {
      skills: [skill('graph', 'codex', 'a'), skill('docs', 'codex', 'c')],
      mcps: [{ name: 'tracker', agent: 'codex', origin: 'plugin', plugin: 'p', project: null, transport: 'remote', host: 'example.com' }],
    },
    antigravity: { skills: [skill('solo', 'antigravity', 'd')], mcps: [] },
  });

  it('puts one book per skill name and flags diverging copies', () => {
    expect(lib.skills.map((s) => s.name).sort()).toEqual(['docs', 'graph', 'solo']);
    expect(lib.skills.find((s) => s.name === 'graph')!.divergent).toBe(false);
    expect(lib.skills.find((s) => s.name === 'docs')!.divergent).toBe(true);
  });

  it('shelves shared skills first, then one shelf per agent', () => {
    expect(shelvesOf(lib).map((s) => [s.key, s.skills.length])).toEqual([
      ['shared', 2],
      ['antigravity', 1],
    ]);
  });

  it('keeps only the host of a remote MCP server', () => {
    expect(lib.mcps[0]).toMatchObject({ name: 'tracker', transport: 'remote', host: 'example.com', agents: ['codex'] });
  });
});

describe('codex config', () => {
  it('reads enabled plugins and MCP servers, nothing else', () => {
    const toml = [
      '[plugins."a@m"]',
      'enabled = true',
      '[plugins."b@m"]',
      'enabled = false',
      '[mcp_servers.local]',
      'command = "secret-path"',
      '[mcp_servers.local.env]',
      'TOKEN = "x"',
      '[mcp_servers.remote]',
      'url = "https://mcp.example.com/mcp"',
    ].join('\n');
    expect(parseCodexConfig(toml)).toEqual({ plugins: ['a@m'], servers: { local: {}, remote: { url: 'https://mcp.example.com/mcp' } } });
  });
});

describe('consumption glass', () => {
  const day = (date: string, fresh: number) => ({ date, fresh, cached: 0, calls: 1 });
  const base: ToolConsumption = {
    agent: 'x',
    days: [day('2026-01-01', 1000), day('2026-01-02', 4000), day('2026-01-03', 2000)],
    today: day('2026-01-03', 2000),
    week: { date: 'semana', fresh: 7000, cached: 0, calls: 3 },
    windows: [],
    limits: { daily: null, weekly: null },
  };

  it('fills against the busiest day when there is no limit', () => {
    const [week, today] = blockValues(base);
    expect(today).toMatchObject({ source: 'histórico', fill: 0.5 });
    expect(week).toMatchObject({ source: 'histórico', fill: 7000 / 28000 });
  });

  it('ignores a plan window that already reset', () => {
    const c = { ...base, windows: [{ label: 'semana', minutes: 10080, usedPercent: 90, resetsAt: '2026-01-01T00:00:00.000Z', seenAt: '' }] };
    expect(blockValues(c, Date.parse('2026-02-01'))[0].source).toBe('histórico');
    expect(blockValues(c, Date.parse('2025-12-31'))[0]).toMatchObject({ source: 'plano', fill: 0.9 });
  });
});
