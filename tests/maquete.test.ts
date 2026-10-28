import { describe, expect, it } from 'vitest';
import { economyOf, type Project } from '../src/maquete/economy.ts';
import { CROSS_Z, LOT_HALF, STREET_HALF, maqueteLayout } from '../src/maquete/layout.ts';
import { CONDO_WIDTH } from '../src/maquete/condo.ts';
import { DEFAULT_OPTIONS } from '../src/memory/schema.ts';
import { emptyTools } from '../src/metrics/usage/types.ts';

const project = (over: Partial<Project['cityphy']> = {}): Project => ({
  name: 'demo',
  root: '/demo',
  nodes: 100,
  edges: 50,
  parts: [],
  cityphy: {
    options: { ...DEFAULT_OPTIONS, graph: true, inject: true, agents: ['claude'] },
    memory: null,
    lessonsTokens: 300,
    savings: { queries: 2, returned: 100, avoided: 1100, saved: 1000, byAgent: { claude: { queries: 2, saved: 1000 } }, last: [] },
    ...over,
  },
});

const usageOf = (sessions: Record<string, number>) => ({
  multipliers: {},
  agents: Object.fromEntries(
    Object.entries(sessions).map(([a, n]) => [a, { breakdown: [], projects: { demo: { sessions: n, models: {}, breakdown: [], tools: { ...emptyTools(), graph: 10, file: 30 } } } }]),
  ),
});

describe('maquete economy', () => {
  it('splits each agent into live, imported (old) and never seen by cityPhy', () => {
    const e = economyOf(project(), usageOf({ claude: 10, codex: 4 }), { claude: { imported: 3, live: 5, firstLive: '2026-10-13T00:00:00Z' } });
    const claude = e.agents.find((a) => a.agent === 'claude')!;
    const codex = e.agents.find((a) => a.agent === 'codex')!;
    expect(claude).toMatchObject({ logSessions: 10, live: 5, imported: 3, outside: 2, status: 'live', saved: 1000 });
    expect(codex).toMatchObject({ logSessions: 4, live: 0, imported: 0, outside: 4, status: 'outside' });
    expect(e.saved).toBe(1000);
    expect(e.graphShare).toBeCloseTo(0.25);
    expect(e.inject).toEqual({ on: true, budget: 800, lessons: 300 });
  });

  it('marks an agent only known from imported sessions as history', () => {
    const e = economyOf(project(), usageOf({}), { claude: { imported: 7, live: 0, firstLive: null } });
    expect(e.agents[0]).toMatchObject({ agent: 'claude', status: 'history', outside: 0 });
    expect(e.graphShare).toBeNull();
  });
});

describe('maquete layout', () => {
  it('keeps every lot off the main street and the cross street', () => {
    const L = maqueteLayout(3, 4);
    for (const a of L.agents) expect(a.x + 8).toBeLessThan(-STREET_HALF);
    for (const p of L.projects) {
      expect(p.x - CONDO_WIDTH / 2).toBeGreaterThan(STREET_HALF);
      expect(p.z - LOT_HALF).toBeGreaterThan(CROSS_Z + 3);
    }
    expect(L.library.z + 14).toBeLessThan(CROSS_Z - 3);
    expect(L.minZ).toBeLessThan(L.radio.z);
  });
});
