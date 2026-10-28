import { describe, expect, it } from 'vitest';
import { mcpKey, skillKey, splitMcpTool, type SessionWork, type WorkReport } from '../src/metrics/work/types.ts';
import { indexUsage, projectUse } from '../src/metrics/work/usageIndex.ts';

const session = (over: Partial<SessionWork>): SessionWork => ({
  agent: 'claude',
  session: 's1',
  title: 'Ajustes',
  startedAt: '2026-10-01T10:00:00Z',
  lastAt: '2026-10-01T11:00:00Z',
  turns: 3,
  skills: {},
  mcp: {},
  ...over,
});

describe('work names', () => {
  it('matches logged names to the library', () => {
    expect(skillKey('anthropic-skills:Built-In-Browser')).toBe('built-in-browser');
    expect(splitMcpTool('mcp__plugin_dotnet-msbuild_binlog__binlog_errors')).toEqual(['plugin_dotnet-msbuild_binlog', 'binlog_errors']);
    expect(splitMcpTool('Read')).toBeNull();
    expect(mcpKey('plugin_dotnet-msbuild_binlog', ['binlog', 'node_repl'])).toBe('binlog');
    expect(mcpKey('Claude_Browser', ['binlog'])).toBe('Claude_Browser');
  });
});

describe('usage index', () => {
  const work: WorkReport = {
    alpha: [
      {
        agent: 'claude',
        toolsRecorded: true,
        sessions: [
          session({ skills: { 'x:graphify': 2 }, mcp: { plugin_a_binlog: { errors: 3, overview: 1 } } }),
          session({ session: 's2', lastAt: '2026-10-05T00:00:00Z', skills: { graphify: 1 } }),
        ],
      },
      { agent: 'codex', toolsRecorded: false, sessions: [session({ agent: 'codex', session: 'c1' })] },
    ],
    beta: [{ agent: 'claude', toolsRecorded: true, sessions: [session({ session: 's3', mcp: { Claude_Browser: { navigate: 2 } } })] }],
  };
  const idx = indexUsage(work, ['binlog']);

  it('adds up skill and MCP use per project, newest conversation first', () => {
    const g = idx.skills.get('graphify')!;
    expect(g.total).toBe(3);
    expect(g.projects).toEqual({ alpha: 3 });
    expect(g.sessions.map((s) => s.session)).toEqual(['s2', 's1']);
    expect(idx.mcps.get('binlog')).toMatchObject({ total: 4, tools: { errors: 3, overview: 1 } });
    expect(idx.mcps.get('Claude_Browser')!.projects).toEqual({ beta: 2 });
  });

  it('tells which agents record tool calls', () => {
    expect(idx.measured).toEqual(['claude']);
    expect(idx.unmeasured).toEqual(['codex']);
  });

  it('lists what one project used', () => {
    expect(projectUse(idx, 'alpha')).toEqual({ skills: [['graphify', 3]], mcps: [['binlog', 4]] });
    expect(projectUse(idx, 'beta').mcps).toEqual([['Claude_Browser', 2]]);
  });
});
