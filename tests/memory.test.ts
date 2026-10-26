import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { observationFromClaudeHook } from '../src/memory/capture/claudeHook.ts';
import { sessionContext } from '../src/memory/inject.ts';
import { DEFAULT_OPTIONS } from '../src/memory/schema.ts';
import { MemoryStore } from '../src/memory/store.ts';
import { buildLessons } from '../src/memory/summarize.ts';
import { sourceFilesOf } from '../src/metrics/queryLog.ts';
import { estimateForCalls } from '../src/metrics/modelStats.ts';
import { ago, isActive } from '../src/metrics/activity/types.ts';

const project = { name: 'shop', path: '/code/shop' };
const tmp = mkdtempSync(join(tmpdir(), 'cityphy-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('claude hook capture', () => {
  const base = { session_id: 's1', cwd: '/code/shop' };
  it('records edits with the file as graphify names it', () => {
    const o = observationFromClaudeHook({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: '/code/shop/src/cart.ts' }, tool_response: 'ok' }, project);
    expect(o?.kind).toBe('edit');
    expect(o?.files).toEqual(['src/cart.ts']);
  });
  it('tells graph queries apart from other commands', () => {
    const q = observationFromClaudeHook({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'graphify query "cart total" --graph g.json' } }, project);
    const c = observationFromClaudeHook({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } }, project);
    expect(q?.kind).toBe('graph-query');
    expect(c?.kind).toBe('command');
  });
  it('ignores events it does not use', () => {
    expect(observationFromClaudeHook({ ...base, hook_event_name: 'Notification' }, project)).toBeNull();
  });
});

describe('memory store', () => {
  it('finds observations by word prefix', () => {
    const store = new MemoryStore(tmp);
    store.add({ agent: 'claude', session: 's1', at: '2026-10-26T10:00:00Z', kind: 'note', summary: 'postes de luz carregam o cabo', files: ['src/scene/powerLine.ts'], tokens: null });
    store.add({ agent: 'codex', session: 's2', at: '2026-10-26T11:00:00Z', kind: 'edit', summary: 'editou src/cart.ts', files: ['src/cart.ts'], tokens: 40 });
    expect(store.search('poste').map((o) => o.agent)).toEqual(['claude']);
    expect(store.stats()).toMatchObject({ observations: 2, sessions: 2, byAgent: { claude: 1, codex: 1 } });
    store.close();
  });
});

describe('session context', () => {
  it('stays within the token budget', () => {
    const sessions = Array.from({ length: 200 }, (_, i) => [
      { agent: 'claude', session: `s${i}`, at: '2026-10-26T10:00:00Z', kind: 'prompt' as const, summary: `pedido: tarefa número ${i} com bastante texto para ocupar espaço`, files: [], tokens: 10 },
    ]);
    const lessons = buildLessons('shop', sessions, 300);
    expect(lessons.length / 4).toBeLessThanOrEqual(300);
    const text = sessionContext('shop', { ...DEFAULT_OPTIONS, graph: true, memory: true, inject: true, injectBudget: 300 }, lessons);
    expect(text.length / 4).toBeLessThanOrEqual(301);
  });
});

describe('model calculator', () => {
  const row = (effort: string, calls: number, input: number, cacheRead: number, output: number) => ({
    model: 'm', effort, calls, input, cacheWrite: 0, cacheRead, output, reasoning: 0, sessions: 1, sessionTotals: [input + cacheRead + output], sessionCalls: [calls],
  });
  it('scales the per-call average to N calls and compares with medium', () => {
    const est = estimateForCalls([row('high', 10, 3000, 1000, 1000), row('medium', 10, 1000, 1000, 1000)], 5, 2);
    expect(est.map((e) => e.effort)).toEqual(['medium', 'high']);
    expect(est[0]).toMatchObject({ fresh: 1000, cached: 500, ratio: 1, weighted: 2000 });
    expect(est[1].ratio).toBe(2);
  });
});

describe('activity', () => {
  const now = '2026-10-26T12:00:00Z';
  it('lights a power line only inside the window', () => {
    expect(isActive('2026-10-26T11:50:00Z', 15, now)).toBe(true);
    expect(isActive('2026-10-26T11:40:00Z', 15, now)).toBe(false);
    expect(isActive(null, 15, now)).toBe(false);
  });
  it('says how long ago in plain words', () => {
    expect(ago('2026-10-26T11:59:40Z', now)).toBe('agora');
    expect(ago('2026-10-26T11:48:00Z', now)).toBe('há 12 min');
    expect(ago('2026-10-23T12:00:00Z', now)).toBe('há 3 dias');
  });
});

describe('query metric', () => {
  it('reads the source files of a graphify answer', () => {
    const answer = 'NODE Cart [src=src/cart.ts loc=L1 community=Community 1]\nNODE total() [src=src/cart.ts loc=L9]\nNODE Price [src=src/price.ts loc=L2]';
    expect(sourceFilesOf(answer)).toEqual(['src/cart.ts', 'src/price.ts']);
  });
});
