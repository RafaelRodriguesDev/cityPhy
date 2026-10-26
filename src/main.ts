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

type Item = PlacedFloor | ProjectBuilding;
const isFloor = (it: Item): it is PlacedFloor => 'node' in it;
const samePath = (a: string, b: string) => a.replace(/[\\/]+/g, '/').toLowerCase() === b.replace(/[\\/]+/g, '/').toLowerCase();

async function main() {
  const [towers, projects] = (await Promise.all([
    fetch('/api/towers').then((r) => r.json()),
    fetch('/api/projects').then((r) => r.json()),
  ])) as [TowerGraph[], ProjectSummary[]];

  const stage = createStage(document.getElementById('scene')!);
  const tooltip = document.getElementById('tooltip')!;
  const panel = document.getElementById('panel')!;

  const towerSpots = layoutTowers(towers.length);
  const projectSpots = layoutProjects(projects.map(projectRowLength), PROJECT_BUILDING_WIDTH);
  const lots = [...towerSpots, ...projectSpots].map((s) => s.lot);
  const { minZ, maxZ } = cityExtent(lots);
  const posts = lampPosts(minZ, maxZ);
  stage.scene.add(buildGround(minZ, maxZ), buildStreetLamps([...posts.west, ...posts.east, ...posts.cross]));
  const lotMin = Math.min(...lots.map((l) => l.minZ));
  const lotMax = Math.max(...lots.map((l) => l.maxZ));
  stage.frame(new Vector3(STREET_X, 6, (lotMin + lotMax) / 2), lotMax - lotMin);

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

  // Project condominiums across the street, each with its own color.
  const condos = projects.map((project, i) => {
    const color = projectColor(i);
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
      if (!worksOn.some((p) => samePath(p, condo.project.root))) continue;
      const line = buildCable(routePowerLine(tower.powerAnchor, condo.fence.entry, posts, condo.slot), condo.color);
      stage.scene.add(line.object);
      addPulses([0, 1, 2].map(() => ({ curve: line.curve, color: condo.color })), 1.4);
      condo.agents.push(graph.graph.cityphy.agentName);
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
  renderSummary(document.getElementById('summary')!, towers, legend, (on) => {
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
        : `<strong>${escapeHtml(it.part.name)}</strong><br>${it.part.files.toLocaleString('pt-BR')} arquivos`;
      tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      tooltip.hidden = false;
    },
    select(it) {
      if (isFloor(it)) showFloor(panel, it, graphOf.get(it.agent)!);
      else showProjectBuilding(panel, it, condos.find((c) => c.project === it.project)?.agents ?? []);
    },
  });
  stage.requestRender();
}

main();
