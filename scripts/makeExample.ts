// Writes a fictional city to examples/data (used by `npm run dev:example` and the README images).
// Nothing here comes from a real machine: projects, files, memories and sessions are made up.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TowerBuilder } from '../src/towers/towerBuilder.ts';

const OUT = join(import.meta.dirname, '..', 'examples', 'data');
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const BASE = Date.parse('2026-10-01T09:00:00Z');
const day = (n: number) => new Date(BASE + n * 86_400_000).toISOString();

interface ExampleProject {
  name: string;
  root: string;
  parts: Array<[folder: string, files: number]>;
}

const PROJECTS: ExampleProject[] = [
  { name: 'shop-api', root: '/home/dev/shop-api', parts: [['src', 420], ['tests', 130], ['infra', 28], ['scripts', 12]] },
  { name: 'web-store', root: '/home/dev/web-store', parts: [['app', 310], ['packages', 160], ['tools', 35]] },
  { name: 'mobile-app', root: '/home/dev/mobile-app', parts: [['lib', 180], ['test', 45], ['assets', 9]] },
];

function writeProject(p: ExampleProject): void {
  const nodes: Array<Record<string, unknown>> = [];
  const links: Array<Record<string, unknown>> = [];
  for (const [folder, files] of p.parts) {
    for (let f = 0; f < files; f++) {
      const file = `${folder}/module${Math.floor(f / 8)}/file${f}.ts`;
      const symbols = 1 + Math.floor(rnd() * 4);
      for (let s = 0; s < symbols; s++) nodes.push({ id: `${folder}_${f}_${s}`, label: `Symbol${f}_${s}`, source_file: file, community: f % 12, file_type: 'code' });
    }
  }
  for (let i = 0; i < nodes.length * 2; i++) {
    links.push({ source: nodes[Math.floor(rnd() * nodes.length)].id, target: nodes[Math.floor(rnd() * nodes.length)].id, relation: 'calls' });
  }
  const dir = join(OUT, p.name, 'graphify-out');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'graph.json'), JSON.stringify({ directed: false, multigraph: false, graph: { schema_version: 1 }, nodes, links, hyperedges: [] }));
  writeFileSync(join(dir, '.graphify_root'), p.root);
}

interface ExampleAgent {
  id: string;
  name: string;
  instructions: string; // its global instruction file
  worksOn: string[];
  skills: string[];
  memories: string[];
  sessions: number;
}

const AGENTS: ExampleAgent[] = [
  {
    id: 'claude', name: 'Claude', instructions: 'CLAUDE.md global', worksOn: ['shop-api', 'web-store'],
    skills: ['run-tests', 'release-notes', 'db-migrations', 'ui-review'],
    memories: ['preferências de commit', 'ambiente local', 'regras de layout', 'onde paramos: checkout', 'decisões de API', 'testes lentos'],
    sessions: 14,
  },
  {
    id: 'codex', name: 'Codex', instructions: 'config.toml', worksOn: ['web-store', 'mobile-app'],
    skills: ['lint-fix', 'bundle-size', 'storybook'],
    memories: ['padrões do monorepo', 'build do app'],
    sessions: 10,
  },
  {
    id: 'antigravity', name: 'Antigravity', instructions: 'GEMINI.md global', worksOn: ['shop-api'],
    skills: ['api-docs', 'load-test', 'k8s-deploy', 'sql-review', 'perf-budget'],
    memories: ['contratos da API', 'limites de carga', 'deploy em staging'],
    sessions: 8,
  },
];

function writeTower(a: ExampleAgent): void {
  const t = new TowerBuilder(a.id, a.name, 8);
  const ground = (id: string, label: string, bytes: number | null, project: string | null = null) =>
    t.addFloor({ id: `${a.id}.ground.${id}`, label, section: 'ground', load: 'always', sourceFile: `(exemplo) ${label}`, bytes, updatedAt: day(20), project });
  const rootOf = (name: string) => PROJECTS.find((p) => p.name === name)!.root;

  ground('built-in', 'Regras do app e ferramentas', null);
  ground('global', a.instructions, 400 + Math.floor(rnd() * 1500));
  for (const p of a.worksOn) {
    ground(`${p}.agents-md`, `AGENTS.md · ${p}`, 3000 + Math.floor(rnd() * 9000), rootOf(p));
    ground(`${p}.skills-list`, `Lista de skills · ${p}`, 800 + Math.floor(rnd() * 3000), rootOf(p));
  }
  ground('memory-index', 'Índice da memória', 600 + Math.floor(rnd() * 1500), rootOf(a.worksOn[0]));

  a.skills.forEach((s) => {
    t.addFloor({ id: `${a.id}.skills.${s}`, label: s, section: 'skills', load: 'on-demand', sourceFile: `(exemplo) ${s}/SKILL.md`, bytes: 1500 + Math.floor(rnd() * 9000), updatedAt: day(10), project: null });
    for (const p of a.worksOn) t.link(`${a.id}.ground.${p}.skills-list`, `${a.id}.skills.${s}`, 'lists');
  });
  a.memories.forEach((m, i) => {
    const id = `${a.id}.memory.m${i}`;
    t.addFloor({ id, label: m, section: 'memory', load: 'on-demand', sourceFile: `(exemplo) memory/${i}.md`, bytes: 300 + Math.floor(rnd() * 3000), updatedAt: day(15 + i), project: rootOf(a.worksOn[0]) });
    t.link(`${a.id}.ground.memory-index`, id, 'indexes');
    if (i > 0 && rnd() > 0.4) t.link(id, `${a.id}.memory.m${i - 1}`, 'links_to');
  });
  const tasks = ['checkout', 'login social', 'relatório de vendas', 'cache de produtos', 'tela de perfil', 'migração do banco', 'testes de carga', 'deploy'];
  for (let s = 0; s < a.sessions; s++) {
    const p = a.worksOn[s % a.worksOn.length];
    t.addFloor({ id: `${a.id}.sessions.s${s}`, label: `${tasks[s % tasks.length]} · ${p}`, section: 'sessions', load: 'history', sourceFile: '(exemplo) sessão', bytes: 200_000 + Math.floor(rnd() * 20_000_000), updatedAt: day(s), project: rootOf(p) });
  }
  t.write(join(OUT, `torre-${a.id}`));
}

PROJECTS.forEach(writeProject);
AGENTS.forEach(writeTower);
console.log(`[cityphy] cidade de exemplo em ${OUT}`);
