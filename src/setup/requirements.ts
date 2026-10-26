import { spawnSync } from 'node:child_process';
import { graphifyBin } from '../metrics/graphifyBin.ts';

export interface Requirement {
  name: string;
  why: string;
  required: boolean;
  found: string | null; // version or "ok"; null = missing
  /** How to install it, when cityPhy can do it for the person (always asked first). */
  install?: { command: string; args: string[] };
  /** Where to get it when cityPhy cannot install it. */
  manual?: string;
}

function version(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) return null;
  return (r.stdout || r.stderr).trim().split('\n')[0] || 'ok';
}

const atLeast = (v: string | null, major: number, minor = 0) => {
  const m = v?.match(/(\d+)\.(\d+)/);
  return !!m && (Number(m[1]) > major || (Number(m[1]) === major && Number(m[2]) >= minor));
};

/** Everything cityPhy needs, checked on this machine. SQLite comes inside Node (node:sqlite). */
export function checkRequirements(): Requirement[] {
  const nodeOk = atLeast(process.versions.node, 24);
  const python = version('python', ['--version']) ?? version('py', ['--version']);
  const uv = version('uv', ['--version']) ?? version('python', ['-m', 'uv', '--version']);
  const pipx = version('pipx', ['--version']);
  const graphify = version(graphifyBin(), ['--help']) ? 'ok' : null;
  const ollama = version('ollama', ['--version']);

  const graphifyInstall = uv
    ? { command: 'uv', args: ['tool', 'install', 'graphifyy'] }
    : pipx
      ? { command: 'pipx', args: ['install', 'graphifyy'] }
      : python
        ? { command: 'python', args: ['-m', 'pip', 'install', '--user', 'graphifyy'] }
        : undefined;

  return [
    { name: 'Node.js 24+', why: 'roda o cityPhy e os geradores; traz o SQLite (node:sqlite) da memória', required: true, found: nodeOk ? process.versions.node : null, manual: 'https://nodejs.org' },
    { name: 'Python 3.10+', why: 'o graphify é feito em Python', required: true, found: atLeast(python, 3, 10) ? python : null, manual: 'https://www.python.org/downloads/' },
    { name: 'uv ou pipx', why: 'instala o graphify isolado (recomendado)', required: false, found: uv ?? pipx, install: python ? { command: 'python', args: ['-m', 'pip', 'install', '--user', 'uv'] } : undefined },
    { name: 'graphify (graphifyy)', why: 'monta o grafo do código (local, sem IA)', required: true, found: graphify, install: graphifyInstall, manual: 'https://github.com/safishamsi/graphify' },
    { name: 'Ollama', why: 'opcional: resumos de memória com IA local', required: false, found: ollama, manual: 'https://ollama.com' },
  ];
}
