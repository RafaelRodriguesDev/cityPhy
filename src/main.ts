import './style.css';
import { Vector3, type InstancedMesh } from 'three';
import type { ProjectSummary } from './readers/projects.ts';
import type { TowerGraph } from './towers/schema.ts';
import { createStage } from './scene/stage.ts';
import { STREET_X, cityExtent, layoutProjects, layoutTowers } from './scene/cityLayout.ts';
import { buildGround } from './scene/ground.ts';
import { buildStreetLamps, lampPosts } from './scene/streetLamps.ts';
import { buildFence } from './scene/fence.ts';
import { buildTower, type PlacedFloor } from './scene/towerMesh.ts';
import { PROJECT_BUILDING_WIDTH, buildProjectBlock, projectRowLength, type ProjectBuilding } from './scene/projectBlock.ts';
import { projectColor } from './scene/projectColors.ts';
import { buildCables } from './scene/cables.ts';
import { buildCable, routePowerLine } from './scene/powerLine.ts';
import { buildLotWiring } from './scene/lotWiring.ts';
import { buildPulses, type PulsePath } from './scene/pulses.ts';
import { setupPicking } from './scene/picking.ts';
import { showFloor } from './ui/floorPanel.ts';
import { showProjectBuilding } from './ui/projectPanel.ts';
import { renderSummary, type ProjectLegend } from './ui/towerSummary.ts';
import { escapeHtml, formatTokens } from './ui/format.ts';
import { showModel } from './ui/modelPanel.ts';
import { buildModelTowers, type ModelBand } from './scene/modelTowers.ts';
import { makeLabel } from './scene/label.ts';
import { groupByModel } from './metrics/modelStats.ts';
import type { UsageReport } from './readers/usage.ts';
import type { ToolConsumption } from './metrics/consumption/types.ts';
import { buildConsumptionTower, type ConsumptionBlock } from './scene/consumptionTower.ts';
import { showConsumption } from './ui/consumptionPanel.ts';
import type { ToolSummary } from './ui/towerSummary.ts';

type Item = PlacedFloor | ProjectBuilding | ModelBand | ConsumptionBlock;
const isFloor = (it: Item): it is PlacedFloor => 'node' in it;
const isModel = (it: Item): it is ModelBand => 'kind' in it && it.kind === 'model';
const isConsumption = (it: Item): it is ConsumptionBlock => 'kind' in it && it.kind === 'consumption';
const AGENT_NAMES: Record<string, string> = { claude: 'Claude', codex: 'Codex', antigravity: 'Antigravity' };
const samePath = (a: string, b: string) => a.replace(/[\\/]+/g, '/').toLowerCase() === b.replace(/[\\/]+/g, '/').toLowerCase();

async function main() {
  const [towers, projects, usage, consumption] = (await Promise.all([
    fetch('/api/towers').then((r) => r.json()),
    fetch('/api/projects').then((r) => r.json()),
    fetch('/api/usage').then((r) => r.json()),
    fetch('/api/consumption').then((r) => r.json()),
  ])) as [TowerGraph[], ProjectSummary[], UsageReport, ToolConsumption[]];

  const stage = createStage(document.getElementById('scene')!);
  const tooltip = document.getElementById('tooltip')!;
  const panel = document.getElementById('panel')!;

  // One complex per agent: its tower (when it has one), its consumption tower and one tower per model it used.
  const towerAgents = towers.map((t) => t.graph.cityphy.agent);
  const consumptionOf = (a: string) => consumption.find((c) => c.agent === a) ?? null;
  const usageOnly = [...new Set([...Object.keys(usage.agents), ...consumption.map((c) => c.agent)])].filter(
    (a) => !towerAgents.includes(a) && (groupByModel(usage.agents[a]?.breakdown ?? []).length || consumptionOf(a)),
  );
  const agents = [...towerAgents, ...usageOnly];
  const rowsOf = (a: string) => usage.agents[a]?.breakdown ?? [];
  const towerSpots = layoutTowers(agents.map((a) => groupByModel(rowsOf(a)).length + (consumptionOf(a) ? 1 : 0)));
  const projectSpots = layoutProjects(projects.map(projectRowLength), PROJECT_BUILDING_WIDTH);
  const lots = [...towerSpots, ...projectSpots].map((s) => s.lot);
  const { minZ, maxZ } = cityExtent(lots);
  const posts = lampPosts(minZ, maxZ);
  stage.scene.add(buildGround(minZ, maxZ), buildStreetLamps([...posts.west, ...posts.east, ...posts.cross]));
  const lotMin = Math.min(...lots.map((l) => l.minZ));
  const lotMax = Math.max(...lots.map((l) => l.maxZ));
  const lotWest = Math.min(STREET_X, ...lots.map((l) => l.minX));
  const lotEast = Math.max(STREET_X, ...lots.map((l) => l.maxX));
  stage.frame(new Vector3((lotWest + lotEast) / 2, 6, (lotMin + lotMax) / 2), Math.max(lotMax - lotMin, (lotEast - lotWest) * 0.8));

  const items: Item[] = [];
  const meshes: InstancedMesh[] = [];
  const graphOf = new Map<string, TowerGraph>();
  const pulseSets: Array<ReturnType<typeof buildPulses>> = [];
  const addPulses = (paths: PulsePath[], size?: number) => {
    const p = buildPulses(paths, size);
    stage.scene.add(p.object);
    stage.addAnimator(p.animator);
    pulseSets.push(p);
  };

  // Project condominiums across the street, each with its own color (members of a group share theirs).
  const groupOf = (p: ProjectSummary) => (p as ProjectSummary & { group?: { name: string; path: string } }).group;
  const colorKeys = [...new Set(projects.map((p) => groupOf(p)?.name ?? p.name))];
  const condos = projects.map((project, i) => {
    const color = projectColor(colorKeys.indexOf(groupOf(project)?.name ?? project.name));
    const block = buildProjectBlock(project, projectSpots[i].origin);
    const fence = buildFence(projectSpots[i].lot, project.name, color.getHex());
    stage.scene.add(block.group, fence.group);
    items.push(...block.buildings.filter(Boolean));
    meshes.push(block.mesh);
    return { project, color, block, fence, slot: i, agents: [] as string[] };
  });

  // Agent towers, their inner cables, and a power line to each project they work on.
  towers.forEach((graph, i) => {
    const tower = buildTower(graph, towerSpots[i].origin);
    stage.scene.add(tower.group, buildFence(towerSpots[i].lot, graph.graph.cityphy.agentName).group);
    items.push(...tower.floors);
    meshes.push(...tower.meshes);
    graphOf.set(graph.graph.cityphy.agent, graph);

    const { object, cables } = buildCables(graph.links, new Map(tower.floors.map((f) => [f.node.id, f])));
    stage.scene.add(object);
    addPulses(cables);

    const worksOn = [...new Set(graph.nodes.map((n) => n.cityphy.project).filter((p): p is string => !!p))];
    for (const condo of condos) {
      const groupRoot = groupOf(condo.project)?.path;
      if (!worksOn.some((p) => samePath(p, condo.project.root) || (groupRoot && samePath(p, groupRoot)))) continue;
      const line = buildCable(routePowerLine(tower.powerAnchor, condo.fence.entry, posts, condo.slot), condo.color);
      stage.scene.add(line.object);
      addPulses([0, 1, 2].map(() => ({ curve: line.curve, color: condo.color })), 1.4);
      condo.agents.push(graph.graph.cityphy.agentName);
    }
  });

  // Model towers of every complex; agents known only from usage logs also power the projects they worked on.
  const nameOf = (a: string) => towers.find((t) => t.graph.cityphy.agent === a)?.graph.cityphy.agentName ?? AGENT_NAMES[a] ?? a;
  agents.forEach((agent, i) => {
    const origin = towerSpots[i].origin;
    const c = consumptionOf(agent);
    if (c) {
      const ct = buildConsumptionTower(c, origin);
      stage.scene.add(ct.group);
      items.push(...ct.blocks);
      meshes.push(ct.mesh);
    }
    const models = buildModelTowers(agent, rowsOf(agent), origin, c ? 1 : 0);
    stage.scene.add(models.group);
    items.push(...models.bands);
    if (models.mesh) meshes.push(models.mesh);
    if (towerAgents.includes(agent)) return;

    stage.scene.add(buildFence(towerSpots[i].lot, nameOf(agent)).group);
    const label = makeLabel(nameOf(agent), 1.4);
    label.position.set(origin.x, 4, origin.z);
    stage.scene.add(label);
    const anchor = new Vector3(origin.x + 3.5, 2.5, origin.z);
    for (const condo of condos) {
      const worked = usage.agents[agent]?.projects;
      if (!worked?.[condo.project.name] && !worked?.[groupOf(condo.project)?.name ?? '']) continue;
      const line = buildCable(routePowerLine(anchor, condo.fence.entry, posts, condo.slot + agents.length), condo.color);
      stage.scene.add(line.object);
      addPulses([0, 1, 2].map(() => ({ curve: line.curve, color: condo.color })), 1.4);
      condo.agents.push(nameOf(agent));
    }
  });

  // Inside each powered condominium, power runs from the gatehouse to every building.
  for (const condo of condos) {
    if (!condo.agents.length) continue;
    const wiring = buildLotWiring(condo.fence.house, condo.block.doors, condo.color);
    stage.scene.add(wiring.group);
    addPulses(wiring.curves.map((curve) => ({ curve, color: condo.color })), 0.9);
  }

  const legend: ProjectLegend[] = condos.map((c) => ({ name: c.project.name, color: c.color.getHex(), agents: c.agents }));
  const tools: ToolSummary[] = agents.map((a) => ({
    agent: a,
    name: nameOf(a),
    tower: towers.find((t) => t.graph.cityphy.agent === a) ?? null,
    consumption: consumptionOf(a),
    models: rowsOf(a),
  }));
  renderSummary(document.getElementById('summary')!, tools, legend, (on) => {
    for (const p of pulseSets) p.setRunning(on);
    stage.requestRender();
  });

  setupPicking<Item>(stage, meshes, items, {
    hover(it, x, y) {
      if (!it) {
        tooltip.hidden = true;
        return;
      }
      tooltip.innerHTML = isFloor(it)
        ? `<strong>${escapeHtml(it.node.label)}</strong><br>${formatTokens(it.node.cityphy.tokensApprox)}`
        : isModel(it)
          ? `<strong>${escapeHtml(it.model)}</strong> · ${escapeHtml(it.row.effort)}<br>${(it.row.input + it.row.cacheWrite + it.row.cacheRead + it.row.output).toLocaleString('pt-BR')} tokens`
          : isConsumption(it)
            ? `<strong>${escapeHtml(nameOf(it.agent))} · ${escapeHtml(it.value.label)}</strong><br>${escapeHtml(it.value.fill === null ? 'sem limite definido' : `${Math.round(it.value.fill * 100)}%`)}`
            : `<strong>${escapeHtml(it.part.name)}</strong><br>${it.part.files.toLocaleString('pt-BR')} arquivos`;
      tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      tooltip.hidden = false;
    },
    select(it) {
      if (isFloor(it)) showFloor(panel, it, graphOf.get(it.agent)!);
      else if (isConsumption(it)) showConsumption(panel, it, nameOf(it.agent));
      else if (isModel(it)) showModel(panel, it, nameOf(it.agent), rowsOf(it.agent), usage.multipliers, Object.keys(usage.agents[it.agent]?.projects ?? {}));
      else showProjectBuilding(panel, it, condos.find((c) => c.project === it.project)?.agents ?? []);
    },
  });
  stage.requestRender();
}

main();
