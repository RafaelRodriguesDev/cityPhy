// Writes a fictional city to examples/data (used by `npm run dev:example` and the README images).
// Nothing here comes from a real machine: projects, files, memories and sessions are made up.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TowerBuilder } from '../src/towers/towerBuilder.ts';
import { buildLibrary } from '../src/library/buildLibrary.ts';
import type { AgentInventory, McpCopy, Origin, SkillCopy } from '../src/library/types.ts';

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

/** Fictional consumption (last 7 days) and per-model usage, so the example shows those towers too. */
function writeUsage(): void {
  const today = new Date();
  const days = (scale: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const p = (n: number) => String(n).padStart(2, '0');
      const fresh = Math.floor((0.3 + rnd()) * scale);
      return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, fresh, cached: fresh * 12, calls: Math.floor(fresh / 4000) };
    });
  const tool = (agent: string, scale: number, limits: { daily: number | null; weekly: number | null }, windows: unknown[] = []) => {
    const list = days(scale);
    const week = list.reduce((t, d) => ({ date: 'semana', fresh: t.fresh + d.fresh, cached: t.cached + d.cached, calls: t.calls + d.calls }), { date: 'semana', fresh: 0, cached: 0, calls: 0 });
    return { agent, days: list, today: list[6], week, windows, limits };
  };
  const consumption = [
    tool('claude', 1_200_000, { daily: 2_000_000, weekly: 10_000_000 }),
    tool('codex', 500_000, { daily: null, weekly: null }, [
      { label: '5 horas', minutes: 300, usedPercent: 38, resetsAt: null, seenAt: today.toISOString() },
      { label: 'semana', minutes: 10080, usedPercent: 61, resetsAt: null, seenAt: today.toISOString() },
    ]),
    tool('antigravity', 300_000, { daily: null, weekly: null }),
  ];
  writeFileSync(join(OUT, 'consumption.json'), JSON.stringify(consumption, null, 2));

  const row = (model: string, effort: string, calls: number) => {
    const input = calls * 900, cacheRead = calls * 30_000, output = calls * 700;
    const sessions = Math.max(1, Math.floor(calls / 60));
    return { model, effort, calls, input, cacheWrite: calls * 400, cacheRead, output, reasoning: Math.floor(output * (effort === 'high' ? 0.6 : effort === 'medium' ? 0.35 : 0.1)), sessions,
      sessionTotals: Array.from({ length: sessions }, () => Math.floor((input + cacheRead + output) / sessions * (0.5 + rnd()))),
      sessionCalls: Array.from({ length: sessions }, () => Math.floor(calls / sessions * (0.5 + rnd())) + 1) };
  };
  const agent = (rows: ReturnType<typeof row>[], projects: string[]) => ({ projects: Object.fromEntries(projects.map((p) => [p, { sessions: 9, models: {}, tools: {}, breakdown: [] }])), breakdown: rows });
  const usage = {
    multipliers: { 'model-pro': { multiplier: 2 }, 'model-fast': { multiplier: 0.5 }, 'gpt-model': { multiplier: 1 } },
    agents: {
      claude: agent([row('model-pro', 'padrão', 900), row('model-fast', 'padrão', 400)], ['shop-api', 'web-store']),
      codex: agent([row('gpt-model', 'low', 300), row('gpt-model', 'medium', 500), row('gpt-model', 'high', 200)], ['web-store', 'mobile-app']),
    },
  };
  writeFileSync(join(OUT, 'usage.json'), JSON.stringify(usage, null, 2));

  // Minutes since each tool last worked in each project: some lines lit (< 15 min), some dark.
  const activity = { claude: { 'shop-api': 2, 'web-store': 600 }, codex: { 'web-store': 5, 'mobile-app': 3000 }, antigravity: { 'shop-api': 240 } };
  writeFileSync(join(OUT, 'activity.json'), JSON.stringify(activity, null, 2));
}

/**
 * The maquete's extra layers: the skill library and MCP servers, conversations with the skills and MCP they used,
 * cityPhy savings and control per project. All made up.
 */
function writeMaquete(): void {
  const shared = ['code-review', 'graphify', 'cityphy'];
  const copy = (agent: string, name: string, origin: Origin, plugin: string | null = null, hash = 'h1'): SkillCopy => ({
    name, agent, origin, plugin, project: null, bytes: 2000 + Math.floor(rnd() * 12_000), tokensApprox: 500 + Math.floor(rnd() * 3000), updatedAt: day(12), hash,
  });
  const mcp = (agent: string, name: string, transport: 'local' | 'remote', origin: McpCopy['origin'] = 'user', plugin: string | null = null): McpCopy => ({
    name, agent, origin, plugin, project: null, transport, host: transport === 'remote' ? 'tools.example.com' : null,
  });
  const inventories: Record<string, AgentInventory> = Object.fromEntries(
    AGENTS.map((a) => [
      a.id,
      {
        // graphify diverges on Antigravity (an older copy), to show the warning.
        skills: [...a.skills.map((k) => copy(a.id, k, a.id === 'codex' ? 'plugin' : 'user', a.id === 'codex' ? 'web-kit' : null)), ...shared.map((k) => copy(a.id, k, 'synced', null, a.id === 'antigravity' && k === 'graphify' ? 'h2' : 'h1'))],
        mcps: [],
      },
    ]),
  );
  inventories.claude.mcps.push(mcp('claude', 'db-inspector', 'local'), mcp('claude', 'issue-tracker', 'remote'));
  inventories.codex.mcps.push(mcp('codex', 'db-inspector', 'local'), mcp('codex', 'storybook', 'local', 'plugin', 'web-kit'));
  writeFileSync(join(OUT, 'library.json'), JSON.stringify(buildLibrary(inventories), null, 2));

  const titles = ['Checkout com cupom', 'Login social', 'Relatório de vendas', 'Cache de produtos', 'Tela de perfil', 'Migração do banco', 'Testes de carga', 'Deploy em staging'];
  const session = (agent: string, i: number, tools: boolean) => {
    const skills: Record<string, number> = {};
    const mcps: Record<string, Record<string, number>> = {};
    if (tools) {
      if (rnd() > 0.4) skills.graphify = 1 + Math.floor(rnd() * 3);
      if (rnd() > 0.6) skills['run-tests'] = 1;
      if (rnd() > 0.5) mcps['db-inspector'] = { query: 2 + Math.floor(rnd() * 20), schema: 1 };
      if (rnd() > 0.7) mcps.browser = { navigate: 5 + Math.floor(rnd() * 40), screenshot: 3 };
    }
    return { agent, session: `${agent}-${i}`, title: titles[i % titles.length], startedAt: day(20 + i), lastAt: day(20 + i), turns: 10 + Math.floor(rnd() * 200), skills, mcp: mcps };
  };
  const work: Record<string, unknown[]> = {};
  for (const p of PROJECTS) {
    work[p.name] = AGENTS.filter((a) => a.worksOn.includes(p.name)).map((a) => {
      const tools = a.id === 'claude';
      return { agent: a.id, toolsRecorded: tools, sessions: Array.from({ length: 4 + Math.floor(rnd() * 5) }, (_, i) => session(a.id, i, tools)) };
    });
  }
  writeFileSync(join(OUT, 'work.json'), JSON.stringify(work, null, 2));

  // Savings and options: shop-api uses the graph a lot, web-store a little, mobile-app not at all.
  const control: Record<string, Record<string, { imported: number; live: number; firstLive: string | null }>> = {};
  const queries: Record<string, number> = { 'shop-api': 14, 'web-store': 3, 'mobile-app': 0 };
  for (const p of PROJECTS) {
    const dir = join(OUT, p.name, 'cityphy');
    mkdirSync(dir, { recursive: true });
    const agents = AGENTS.filter((a) => a.worksOn.includes(p.name)).map((a) => a.id);
    writeFileSync(join(dir, 'project.json'), JSON.stringify({ graph: true, memory: true, inject: true, injectBudget: 800, metrics: true, localLlm: false, agents: agents.slice(0, 1) }, null, 2));
    const lines = Array.from({ length: queries[p.name] }, (_, i) => {
      const avoided = 20_000 + Math.floor(rnd() * 90_000);
      return JSON.stringify({ at: day(20 + i / 3), agent: agents[i % agents.length], question: `(exemplo) consulta ${i + 1}`, returned: Math.floor(avoided * (0.02 + rnd() * 0.05)), avoided, files: 3 + Math.floor(rnd() * 12) });
    });
    writeFileSync(join(dir, 'metrics.jsonl'), lines.map((l) => `${l}\n`).join(''));
    control[p.name] = Object.fromEntries(agents.map((a, i) => [a, i === 0 ? { imported: 3, live: 4, firstLive: day(18) } : { imported: 0, live: 0, firstLive: null }]));
  }
  writeFileSync(join(OUT, 'control.json'), JSON.stringify(control, null, 2));
}

PROJECTS.forEach(writeProject);
AGENTS.forEach(writeTower);
writeUsage();
writeMaquete();
console.log(`[cityphy] cidade de exemplo em ${OUT}`);
