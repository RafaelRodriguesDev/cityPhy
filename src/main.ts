import './style.css';
import { Color, Vector3, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three';
import { ago, isActive, type ActivityReport } from './metrics/activity/types.ts';
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
const INACTIVE_CABLE = new Color(0x56606f);
const ACTIVITY_POLL_MS = 30_000;
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
    return p;
  };
  /** What the panel toggles change: pulses on/off and whether dark (inactive) cables are drawn. */
  const view = { pulses: true, showInactive: true };

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
  type Condo = (typeof condos)[number];

  // One power line per (tool, project) that ever worked together; lit or dark depending on activity.
  const powerLines: Array<{ agent: string; name: string; condo: Condo; mesh: Mesh; pulses: ReturnType<typeof buildPulses>; last: string | null }> = [];
  const addPowerLine = (agent: string, name: string, condo: Condo, from: Vector3, slot: number) => {
    const line = buildCable(routePowerLine(from, condo.fence.entry, posts, slot), condo.color);
    stage.scene.add(line.object);
    const pulses = addPulses([0, 1, 2].map(() => ({ curve: line.curve, color: condo.color })), 1.4);
    powerLines.push({ agent, name, condo, mesh: line.object, pulses, last: null });
    condo.agents.push(name);
  };

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
      addPowerLine(graph.graph.cityphy.agent, graph.graph.cityphy.agentName, condo, tower.powerAnchor, condo.slot);
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
      addPowerLine(agent, nameOf(agent), condo, anchor, condo.slot + agents.length);
    }
  });

  // Inside each powered condominium, power runs from the gatehouse to every building.
  const lotWirings = condos
    .filter((condo) => condo.agents.length)
    .map((condo) => {
      const wiring = buildLotWiring(condo.fence.house, condo.block.doors, condo.color);
      stage.scene.add(wiring.group);
      return { condo, group: wiring.group, pulses: addPulses(wiring.curves.map((curve) => ({ curve, color: condo.color })), 0.9) };
    });

  // Power is lit only while a tool is working in the project (recent writes to its logs); otherwise the cable stays, dark.
  let lastActivity: ActivityReport | null = null;
  const applyActivity = (report: ActivityReport) => {
    lastActivity = report;
    const litCondos = new Set<Condo>();
    for (const l of powerLines) {
      const per = report.agents[l.agent] ?? {};
      l.last = per[l.condo.project.name] ?? per[groupOf(l.condo.project)?.name ?? ''] ?? null;
      const on = isActive(l.last, report.windowMinutes, report.generatedAt);
      if (on) litCondos.add(l.condo);
      const mat = l.mesh.material as MeshBasicMaterial;
      mat.color.copy(on ? l.condo.color : INACTIVE_CABLE);
      mat.opacity = on ? 0.85 : 0.28;
      l.mesh.visible = on || view.showInactive;
      l.pulses.setRunning(on && view.pulses);
    }
    for (const w of lotWirings) {
      const on = litCondos.has(w.condo);
      w.group.traverse((o) => {
        const m = (o as { material?: MeshBasicMaterial }).material;
        if (m?.color) {
          m.color.copy(on ? w.condo.color : INACTIVE_CABLE);
          m.opacity = on ? 0.8 : 0.25;
        }
      });
      w.pulses.setRunning(on && view.pulses);
    }
    stage.requestRender();
  };
  const refreshActivity = () =>
    fetch('/api/activity')
      .then((r) => r.json())
      .then((a: ActivityReport) => applyActivity(a))
      .catch(() => undefined);
  await refreshActivity();
  setInterval(refreshActivity, ACTIVITY_POLL_MS);

  const legend: ProjectLegend[] = condos.map((c) => ({ name: c.project.name, color: c.color.getHex(), agents: c.agents }));
  const tools: ToolSummary[] = agents.map((a) => ({
    agent: a,
    name: nameOf(a),
    tower: towers.find((t) => t.graph.cityphy.agent === a) ?? null,
    consumption: consumptionOf(a),
    models: rowsOf(a),
  }));
  renderSummary(document.getElementById('summary')!, tools, legend, {
    onPulses(on) {
      view.pulses = on;
      for (const p of pulseSets) p.setRunning(on);
      if (lastActivity) applyActivity(lastActivity); // power lines only pulse while active
      stage.requestRender();
    },
    onShowInactive(on) {
      view.showInactive = on;
      if (lastActivity) applyActivity(lastActivity);
    },
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
      else {
        // "Energia de": each tool that ever worked here, with when it last did.
        const now = lastActivity?.generatedAt ?? new Date().toISOString();
        const win = lastActivity?.windowMinutes ?? 15;
        const feeds = powerLines
          .filter((l) => l.condo.project === it.project)
          .map((l) => `${l.name} · ${isActive(l.last, win, now) ? 'ativo agora' : ago(l.last, now)}`);
        showProjectBuilding(panel, it, feeds);
      }
    },
  });
  stage.requestRender();
}

main();
