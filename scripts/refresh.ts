// Refreshes the whole city: the graphify graph of every configured project, then every agent tower.
// Usage: npm run refresh                      (projects + towers)
//        npm run refresh -- --towers           (towers only)
//        npm run refresh -- --project <name>   (one project + towers)
// Only graphify's local AST pass runs (GRAPHIFY_BACKEND=none): no code leaves the machine.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../src/config/loadConfig.ts';
import { graphifyBin } from '../src/metrics/graphifyBin.ts';

const config = loadConfig();
const towersOnly = process.argv.includes('--towers');
const graphify = graphifyBin();
const isWindows = process.platform === 'win32';
/** graphify is a .cmd shim on Windows, so it runs through the shell: quote paths and patterns there. */
const q = (s: string) => (isWindows ? `"${s}"` : s);
let failed = 0;

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = {}, shell = false): boolean {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell, env: { ...process.env, ...env } });
  if (r.status !== 0) failed++;
  return r.status === 0;
}

// --project <name> refreshes one project only (big monorepo systems take minutes each).
const only = process.argv.includes('--project') ? process.argv[process.argv.indexOf('--project') + 1] : null;

if (!towersOnly) {
  for (const p of config.projects.filter((x) => !only || x.name === only)) {
    const out = join(config.dataDir, p.name);
    const excludes = (p.exclude ?? []).flatMap((e) => ['--exclude', q(e)]);
    const env: NodeJS.ProcessEnv = { GRAPHIFY_BACKEND: 'none', ...(config.maxGraphBytes ? { GRAPHIFY_MAX_GRAPH_BYTES: String(config.maxGraphBytes) } : {}) };
    if (run(graphify, ['extract', q(p.path), '--code-only', '--out', q(out), ...excludes], env, isWindows)) {
      run(graphify, ['cluster-only', q(out), '--no-label', '--graph', q(join(out, 'graphify-out', 'graph.json'))], env, isWindows);
    }
  }
}

// Every src/towers/<agent>/build*Tower.ts is a generator.
const towersDir = join(import.meta.dirname, '..', 'src', 'towers');
for (const agent of readdirSync(towersDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = join(towersDir, agent.name);
  const builder = readdirSync(dir).find((f) => /^build.*Tower\.ts$/.test(f));
  if (builder && existsSync(join(dir, builder))) run(process.execPath, [join(dir, builder)]);
}

console.log(failed ? `\n[cityphy] refresh terminou com ${failed} falha(s).` : '\n[cityphy] refresh ok.');
process.exit(failed ? 1 : 0);
