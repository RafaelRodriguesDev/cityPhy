import { describe, expect, it } from 'vitest';
import { summarize } from '../src/readers/projects.ts';
import { samePath } from '../src/towers/cli.ts';
import { projectKey } from '../src/towers/claude/sources.ts';
import { agentWorkspaces } from '../src/config/groups.ts';
import { findProject, groupMembers } from '../src/memory/paths.ts';

describe('project summary', () => {
  it('groups files by top folder and skips external symbols', () => {
    const s = summarize('demo', '/x/demo', {
      nodes: [
        { source_file: 'api/a.cs' },
        { source_file: 'api/a.cs' },
        { source_file: 'api/b.cs' },
        { source_file: 'web/c.ts' },
        { source_file: 'README.md' },
        {}, // external type like Task or Guid
      ],
      links: [1, 2, 3],
    });
    expect(s.parts).toEqual([
      { name: 'api', nodes: 3, files: 2 },
      { name: 'web', nodes: 1, files: 1 },
      { name: '(raiz)', nodes: 1, files: 1 },
    ]);
    expect(s.edges).toBe(3);
  });
});

describe('project groups (monorepos)', () => {
  const group = { name: 'Corp', path: 'C:/code/corp' };
  const config = {
    dataDir: 'C:/data',
    projects: [
      { name: 'Corp-API', path: 'C:/code/corp/API', group },
      { name: 'Corp-Web', path: 'C:/code/corp/Web', group },
      { name: 'solo', path: 'C:/code/solo' },
    ],
  };
  it('lets agents work at the group root once, not once per member', () => {
    expect(agentWorkspaces(config.projects).map((w) => w.name)).toEqual(['solo', 'Corp']);
  });
  it('finds the member for a folder inside it and the group for the root', () => {
    expect(findProject(config, 'C:\\code\\corp\\API\\src')?.name).toBe('Corp-API');
    expect(findProject(config, 'C:\\code\\corp')?.name).toBe('Corp');
    expect(findProject(config, 'C:/code/corp/tools')?.name).toBe('Corp');
    expect(groupMembers(config, findProject(config, 'Corp')!).map((m) => m.name)).toEqual(['Corp-API', 'Corp-Web']);
  });
});

describe('paths', () => {
  it('compares Windows and POSIX spellings of the same folder', () => {
    expect(samePath('C:\\code\\Shop', 'c:/code/shop/')).toBe(true);
    expect(samePath('C:/a', 'C:/b')).toBe(false);
  });

  it('names the Claude project folder like Claude Code does', () => {
    expect(projectKey('C:\\code\\shop-api')).toBe('C--code-shop-api');
  });
});
