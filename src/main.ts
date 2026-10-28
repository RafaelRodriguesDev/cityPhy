import './style.css';
import { Color, Vector3, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three';
import { ago, isActive, type ActivityReport } from './metrics/activity/types.ts';
import type { ProjectSummary } from './readers/projects.ts';
import type { TowerGraph } from './towers/schema.ts';
import { createStage } from './scene/stage.ts';
import { STREET_X, cityExtent, layoutCivic, layoutProjects, layoutTowers } from './scene/cityLayout.ts';
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
import { renderHud } from './ui/hud.ts';
import { showAgent } from './ui/agentPanel.ts';
import type { AgentView } from './ui/agentView.ts';
import { showLibrary, showMcp, showSkill } from './ui/libraryPanel.ts';
import type { Library } from './library/types.ts';
import { LIBRARY_DEPTH, buildLibrary, libraryLength, type Book } from './scene/library.ts';
import { buildRadio, radioLength, radioWidth, type Antenna } from './scene/radio.ts';
import { escapeHtml, formatTokens } from './ui/format.ts';
import { showModel } from './ui/modelPanel.ts';
import { buildModelTowers, type ModelBand } from './scene/modelTowers.ts';
import { makeLabel } from './scene/label.ts';
import { groupByModel } from './metrics/modelStats.ts';
import type { UsageReport } from './readers/usage.ts';
import type { ToolConsumption } from './metrics/consumption/types.ts';
import { buildConsumptionTower, type ConsumptionBlock } from './scene/consumptionTower.ts';
import { showConsumption } from './ui/consumptionPanel.ts';

type Item = PlacedFloor | ProjectBuilding | ModelBand | ConsumptionBlock | Book | Antenna;
const isFloor = (it: Item): it is PlacedFloor => 'node' in it;
const isBook = (it: Item): it is Book => 'kind' in it && it.kind === 'book';
const isAntenna = (it: Item): it is Antenna => 'kind' in it && it.kind === 'mcp';
const isModel = (it: Item): it is ModelBand => 'kind' in it && it.kind === 'model';
const isConsumption = (it: Item): it is ConsumptionBlock => 'kind' in it && it.kind === 'consumption';
const AGENT_NAMES: Record<string, string> = { claude: 'Claude', codex: 'Codex', antigravity: 'Antigravity' };
const INACTIVE_CABLE = new Color(0x56606f);
const ACTIVITY_POLL_MS = 30_000;
const samePath = (a: string, b: string) => a.replace(/[\\/]+/g, '/').toLowerCase() === b.replace(/[\\/]+/g, '/').toLowerCase();

async function main() {
  const [towers, projects, usage, consumption, library] = (await Promise.all([
    fetch('/api/towers').then((r) => r.json()),
    fetch('/api/projects').then((r) => r.json()),
    fetch('/api/usage').then((r) => r.json()),
    fetch('/api/consumption').then((r) => r.json()),
    fetch('/api/library').then((r) => r.json()),
  ])) as [TowerGraph[], ProjectSummary[], UsageReport, ToolConsumption[], Library];

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
  // Civic district: the library (one bookcase per shelf) and the radio park (one antenna per MCP server), along the street.
  const libLength = libraryLength(library);
  const civicLength = libLength + (library.mcps.length ? (libLength ? 4 : 0) + radioLength(library.mcps.length) : 0);
  const civicWidth = Math.max(LIBRARY_DEPTH, radioWidth(library.mcps.length), 4);
  const civic = civicLength ? layoutCivic(civicLength, civicWidth) : null;
  const projectSpots = layoutProjects(projects.map(projectRowLength), PROJECT_BUILDING_WIDTH, civic ? civic.lot.minZ - 8 : undefined);
  const lots = [...towerSpots, ...projectSpots, ...(civic ? [civic] : [])].map((s) => s.lot);
  const { minZ, maxZ } = cityExtent(lots);
  const posts = lampPosts(minZ, maxZ);
  stage.scene.add(buildGround(minZ, maxZ), buildStreetLamps([...posts.west, ...posts.east, ...posts.cross]));
  const lotMin = Math.min(...lots.map((l) => l.minZ));
  const lotMax = Math.max(...lots.map((l) => l.maxZ));
  const lotWest = Math.min(STREET_X, ...lots.map((l) => l.minX));
  const lotEast = Math.max(STREET_X, ...lots.map((l) => l.maxX));
  const overview = () => stage.frame(new Vector3((lotWest + lotEast) / 2, 6, (lotMin + lotMax) / 2), Math.max(lotMax - lotMin, (lotEast - lotWest) * 0.8));
  overview();
  /** Camera on one lot (sidebar cards). */
  const focusLot = (l: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
    stage.focus(new Vector3((l.minX + l.maxX) / 2, 4, (l.minZ + l.maxZ) / 2), Math.max(l.maxX - l.minX, l.maxZ - l.minZ) * 1.5);

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
    return { project, color, block, fence, slot: i, agents: [] as string[] }; // agent ids feeding it
  });
  type Condo = (typeof condos)[number];

  // One power line per (tool, project) that ever worked together; lit or dark depending on activity.
  const powerLines: Array<{ agent: string; name: string; condo: Condo; mesh: Mesh; pulses: ReturnType<typeof buildPulses>; last: string | null }> = [];
  const addPowerLine = (agent: string, name: string, condo: Condo, from: Vector3, slot: number) => {
    const line = buildCable(routePowerLine(from, condo.fence.entry, posts, slot), condo.color);
    stage.scene.add(line.object);
    const pulses = addPulses([0, 1, 2].map(() => ({ curve: line.curve, color: condo.color })), 1.4);
    powerLines.push({ agent, name, condo, mesh: line.object, pulses, last: null });
    condo.agents.push(agent);
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

  if (civic) {
    stage.scene.add(buildFence(civic.lot, 'Centro cívico').group);
    const books = buildLibrary(library, civic.origin);
    const radioOrigin = { x: civic.origin.x, z: civic.origin.z - libLength - (libLength ? 4 : 0) };
    const radio = buildRadio(library.mcps, radioOrigin);
    stage.scene.add(books.group, radio.group);
    items.push(...books.books, ...radio.antennas);
    for (const mesh of [books.mesh, radio.mesh]) if (mesh) meshes.push(mesh);
  }

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
    renderPanels();
  };
  const refreshActivity = () =>
    fetch('/api/activity')
      .then((r) => r.json())
      .then((a: ActivityReport) => applyActivity(a))
      .catch(() => undefined);

  // Sidebar and HUD: rebuilt whenever activity changes (who is working now).
  const nowIso = () => lastActivity?.generatedAt ?? new Date().toISOString();
  const viewOf = (a: string): AgentView => {
    const per = Object.values(lastActivity?.agents[a] ?? {}).filter((t): t is string => !!t).sort();
    const lastActive = per.at(-1) ?? null;
    return {
      agent: a,
      name: nameOf(a),
      tower: towers.find((t) => t.graph.cityphy.agent === a) ?? null,
      consumption: consumptionOf(a),
      models: rowsOf(a),
      powers: condos.filter((c) => c.agents.includes(a)).map((c) => c.project.name),
      lastActive,
      activeNow: !!lastActivity && isActive(lastActive, lastActivity.windowMinutes, lastActivity.generatedAt),
    };
  };
  const openAgent = (a: string) => showAgent(panel, viewOf(a), library, nowIso());
  const openLibrary = () => showLibrary(panel, library, nameOf);
  // Sidebar cards also take the camera there.
  const goAgent = (a: string) => {
    openAgent(a);
    focusLot(towerSpots[agents.indexOf(a)].lot);
  };
  const goLibrary = () => {
    openLibrary();
    if (civic) focusLot(civic.lot);
  };
  const feedsOf = (project: ProjectSummary) => {
    const now = nowIso();
    const win = lastActivity?.windowMinutes ?? 15;
    return powerLines
      .filter((l) => l.condo.project === project)
      .map((l) => ({ agent: l.agent, name: l.name, status: isActive(l.last, win, now) ? 'ativo agora' : ago(l.last, now) }));
  };
  const openProject = (name: string) => {
    const condo = condos.find((c) => c.project.name === name);
    const building = condo?.block.buildings.find(Boolean);
    if (condo && building) showProjectBuilding(panel, building, feedsOf(condo.project));
    if (condo) focusLot(projectSpots[condo.slot].lot);
  };
  const legend: ProjectLegend[] = condos.map((c) => ({
    name: c.project.name,
    color: c.color.getHex(),
    agents: c.agents,
    nodes: c.project.nodes,
    buildings: c.block.buildings.filter(Boolean).length,
  }));
  function renderPanels() {
    const views = agents.map(viewOf);
    renderHud(document.getElementById('hud')!, views, library, { onAgent: goAgent, onLibrary: goLibrary });
    renderSummary(document.getElementById('summary')!, views, legend, library, view, nowIso(), nameOf, {
      onAgent: goAgent,
      onProject: openProject,
      onLibrary: goLibrary,
      onOverview: overview,
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
  }
  renderPanels();
  await refreshActivity();
  setInterval(refreshActivity, ACTIVITY_POLL_MS);

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
            ? `<strong>${escapeHtml(nameOf(it.agent))} · ${escapeHtml(it.value.label)}</strong><br>${escapeHtml(it.value.text)}`
            : isBook(it)
              ? `<strong>${escapeHtml(it.skill.name)}</strong><br>skill · ${escapeHtml(it.skill.agents.map(nameOf).join(', '))}`
              : isAntenna(it)
                ? `<strong>${escapeHtml(it.mcp.name)}</strong><br>MCP ${it.mcp.transport === 'remote' ? 'remoto' : 'local'} · ${escapeHtml(it.mcp.agents.map(nameOf).join(', '))}`
                : `<strong>${escapeHtml(it.part.name)}</strong><br>${it.part.files.toLocaleString('pt-BR')} arquivos`;
      tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      tooltip.hidden = false;
    },
    select(it) {
      if (isFloor(it)) showFloor(panel, it, graphOf.get(it.agent)!);
      else if (isConsumption(it)) showConsumption(panel, it, nameOf(it.agent));
      else if (isModel(it)) showModel(panel, it, nameOf(it.agent), rowsOf(it.agent), usage.multipliers, Object.keys(usage.agents[it.agent]?.projects ?? {}));
      else if (isBook(it)) showSkill(panel, it, nameOf);
      else if (isAntenna(it)) showMcp(panel, it, nameOf);
      else showProjectBuilding(panel, it, feedsOf(it.project));
    },
  });
  stage.requestRender();
}

main();
