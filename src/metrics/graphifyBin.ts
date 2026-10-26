import { spawnSync } from 'node:child_process';
import { loadConfig } from '../config/loadConfig.ts';

/** graphify command: GRAPHIFY_BIN, else `graphifyBin` in cityphy.config.json, else `graphify` from PATH. */
export function graphifyBin(): string {
  return process.env.GRAPHIFY_BIN ?? loadConfig().graphifyBin ?? 'graphify';
}

/**
 * Runs graphify and returns its output. A .cmd/.bat shim (Windows) needs the shell, so arguments
 * are quoted and stripped of shell metacharacters there.
 */
export function runGraphify(args: string[], env: NodeJS.ProcessEnv = {}): { ok: boolean; out: string } {
  const bin = graphifyBin();
  const viaShell = process.platform === 'win32' && !/\.exe$/i.test(bin);
  const safe = viaShell ? args.map((a) => `"${a.replace(/["%^&|<>]/g, ' ')}"`) : args;
  const r = spawnSync(viaShell ? `"${bin}"` : bin, safe, {
    shell: viaShell,
    encoding: 'utf8',
    env: { ...process.env, GRAPHIFY_BACKEND: 'none', ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0 || r.status === 3 || r.status === 4, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
