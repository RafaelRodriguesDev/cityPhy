import { describe, expect, it } from 'vitest';
import { summarize } from '../src/readers/projects.ts';
import { samePath } from '../src/towers/cli.ts';
import { projectKey } from '../src/towers/claude/sources.ts';

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

describe('paths', () => {
  it('compares Windows and POSIX spellings of the same folder', () => {
    expect(samePath('C:\\code\\Shop', 'c:/code/shop/')).toBe(true);
    expect(samePath('C:/a', 'C:/b')).toBe(false);
  });

  it('names the Claude project folder like Claude Code does', () => {
    expect(projectKey('C:\\code\\shop-api')).toBe('C--code-shop-api');
  });
});
