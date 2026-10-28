import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assignedProjectId, projectForCwd, readSessionMetadata, sessionIdFromPath } from './sessionsFloor.ts';
import type { CodexProjectSources } from './sources.ts';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Codex session metadata', () => {
  it('reads only the session header fields exposed to the tower', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cityphy-codex-'));
    tempDirs.push(dir);
    const path = join(dir, 'rollout-2026-01-01T00-00-00-01a11111-2222-3333-4444-555555555555.jsonl');
    writeFileSync(
      path,
      `${JSON.stringify({ type: 'session_meta', timestamp: '2026-01-01T00:00:00.000Z', payload: { id: '01a11111-2222-3333-4444-555555555555', cwd: 'C:/code/demo' } })}\n${JSON.stringify({ type: 'response_item', payload: { message: 'PRIVATE_SENTINEL' } })}\n`,
    );

    const metadata = readSessionMetadata(path);
    expect(metadata).toEqual({
      id: '01a11111-2222-3333-4444-555555555555',
      cwd: 'C:/code/demo',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(metadata)).not.toContain('PRIVATE_SENTINEL');
  });

  it('gets stable ids from compressed log names without opening the transcript', () => {
    expect(sessionIdFromPath('rollout-2026-01-01-01a11111-2222-3333-4444-555555555555.jsonl.zst')).toBe(
      '01a11111-2222-3333-4444-555555555555',
    );
  });

  it('falls back to the filename when an uncompressed log disappears', () => {
    const path = join(tmpdir(), 'rollout-2026-01-01-01a11111-2222-3333-4444-555555555555.jsonl');
    expect(readSessionMetadata(path)).toEqual({
      id: '01a11111-2222-3333-4444-555555555555',
      cwd: null,
      startedAt: null,
    });
  });

  it('reads current and legacy thread-to-project assignment shapes', () => {
    expect(assignedProjectId({ projectKind: 'local', projectId: 'project-1' })).toBe('project-1');
    expect(assignedProjectId('project-2')).toBe('project-2');
    expect(assignedProjectId({ projectKind: 'chatgpt' })).toBeNull();
  });

  it('uses the most specific selected project for a nested cwd', () => {
    const projects: CodexProjectSources[] = [
      { name: 'root', path: 'C:/code', key: 'root', codexSkillsDir: '', agentsSkillsDir: '' },
      { name: 'nested', path: 'C:/code/app', key: 'nested', codexSkillsDir: '', agentsSkillsDir: '' },
    ];
    expect(projectForCwd('C:\\code\\app\\src', projects)?.name).toBe('nested');
  });
});

