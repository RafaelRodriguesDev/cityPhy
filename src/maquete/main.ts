import './maquete.css';
import * as THREE from 'three';
import { isActive, ago, type ActivityReport } from '../metrics/activity/types.ts';
import type { TowerGraph } from '../towers/schema.ts';
import type { UsageReport } from '../readers/usage.ts';
import type { ToolConsumption } from '../metrics/consumption/types.ts';
import type { Library } from '../library/types.ts';
import type { ProjectControl } from '../readers/control.ts';
import type { Antenna } from '../scene/radio.ts';
import { blockValues } from '../scene/consumptionTower.ts';
import { showAgent } from '../ui/agentPanel.ts';
import { showMcp, showSkill } from '../ui/libraryPanel.ts';
import type { Book } from '../scene/library.ts';
import type { WorkReport } from '../metrics/work/types.ts';
import { indexUsage, projectUse, type Use } from '../metrics/work/usageIndex.ts';
import { showLibraryView, type LibTab } from './libraryView.ts';
import { type AgentView, agentColor, short } from '../ui/agentView.ts';
import { escapeHtml } from '../ui/format.ts';
import { createMaqueteStage } from './stage.ts';
import { maqueteLayout } from './layout.ts';
import { buildStreets } from './streets.ts';
import { buildAgentTower } from './agentTower.ts';
import { buildGlass } from './glass.ts';
import { appendCalibration } from './calibrationView.ts';
import { buildLibraryHall } from './libraryHall.ts';
import { buildRadioMast } from './radioMast.ts';
import { buildCondo, CONDO_WIDTH } from './condo.ts';
import { buildStation, radioLink, stationX } from './antennaStation.ts';
import { planStation } from './stationPlan.ts';
import { MCP_COLOR } from '../scene/radio.ts';
import { buildPowerLine, type PowerLine } from './powerLine.ts';
import { sign, type Pick } from './kit.ts';
import { economyOf, type Project } from './economy.ts';
import { renderMaqueteHud } from './hud.ts';
import { renderSidebar, type SideTab } from './sidebar.ts';
import { PROJECTS_PER_PAGE, showProjectView, type ProjectSection } from './projectView.ts';

const AGENT_NAMES: Record<string, string> = { claude: 'Claude', codex: 'Codex', antigravity: 'Antigravity' };
/** Muted project colors that read well on the light ground. */
const PROJECT_COLORS = [0x8b7cf6, 0x2bb39a, 0xd9a441, 0xd4537e, 0x378add, 0x639922];
const POLL_MS = 30_000;
const samePath = (a: string, b: string) => a.replace(/[\\/]+/g, '/').toLowerCase() === b.replace(/[\\/]+/g, '/').toLowerCase();
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

async function main() {
  const get = (u: string) => fetch(u).then((r) => r.json());
  const [towers, projects, usage, consumption, library, control] = (await Promise.all(
    ['/api/towers', '/api/projects', '/api/usage', '/api/consumption', '/api/library', '/api/control'].map(get),
  )) as [TowerGraph[], Project[], UsageReport, ToolConsumption[], Library, Record<string, ProjectControl>];

  const stage = createMaqueteStage(document.getElementById('scene')!);
  const panel = document.getElementById('panel')!;
  const tooltip = document.getElementById('tooltip')!;

  const towerOf = (a: string) => towers.find((t) => t.graph.cityphy.agent === a) ?? null;
  const consumptionOf = (a: string) => consumption.find((c) => c.agent === a) ?? null;
  const agents = [...new Set([...towers.map((t) => t.graph.cityphy.agent), ...consumption.map((c) => c.agent), ...Object.keys(usage.agents)])].filter(
    (a) => towerOf(a) || consumptionOf(a) || Object.keys(usage.agents[a]?.projects ?? {}).length,
  );
  const nameOf = (a: string) => towerOf(a)?.graph.cityphy.agentName ?? AGENT_NAMES[a] ?? a;
  const colorOf = (name: string) => PROJECT_COLORS[Math.max(0, projects.findIndex((p) => p.name === name)) % PROJECT_COLORS.length];
  const economies = projects.map((p) => economyOf(p, usage, control[p.name] ?? {}));

  const L = maqueteLayout(agents.length, projects.length);
  const streets = buildStreets(L.minZ, L.maxZ);
  stage.scene.add(streets.group);
  stage.setExtent(L.minZ, L.maxZ);

  // Agents: tower + glasses, a sign above.
  const glasses = new Map<string, THREE.Group>();
  const anchors = new Map<string, THREE.Vector3>();
  agents.forEach((a, i) => {
    const at = L.agents[i];
    const t = buildAgentTower(towerOf(a), a, agentColor(a), at);
    stage.scene.add(t.group);
    anchors.set(a, t.anchor);
    const c = consumptionOf(a);
    if (c) {
      const g = buildGlass(c, a, { x: at.x - 12, z: at.z + 4 });
      glasses.set(a, g);
      stage.scene.add(g);
    }
    const s = sign(nameOf(a), 3.6, c ? `semana ${short(c.week.fresh)}` : undefined);
    s.position.set(at.x, t.top + 2.5, at.z);
    stage.scene.add(s);
  });

  // Civic district: library and radio park.
  stage.scene.add(buildLibraryHall(library, L.library));
  const libSign = sign('Biblioteca', 3.8, `${library.skills.length} skills`);
  libSign.position.set(L.library.x, 17, L.library.z);
  stage.scene.add(libSign);
  const radioTops = new Map<string, THREE.Vector3>();
  library.mcps.forEach((m, i) => {
    const at = { x: L.radio.x - 8 + (i % 3) * 10, z: L.radio.z + Math.floor(i / 3) * 12 + (i % 2) * 4 };
    const mast = buildRadioMast(m, i, at);
    stage.scene.add(mast.group);
    stage.addAnimator(mast.animate);
    radioTops.set(m.name, mast.top);
    const s = sign(m.name, 2.8, m.transport === 'remote' ? `remoto · ${m.host ?? ''}` : 'MCP local');
    s.position.set(at.x, 14 + 4 * m.agents.length + (m.transport === 'remote' ? 6 : 0) + 7, at.z);
    stage.scene.add(s);
  });

  // Projects and their power lines.
  const lines: PowerLine[] = [];
  projects.forEach((p, i) => {
    const color = colorOf(p.name);
    const condo = buildCondo(p, color, L.projects[i]);
    stage.scene.add(condo.group);
    const s = sign(p.name, 3.8, economies[i].saved ? `economia ≈ ${short(economies[i].saved)}` : undefined);
    s.position.set(L.projects[i].x, 16, L.projects[i].z);
    stage.scene.add(s);
    for (const a of agents) {
      const keys = [p.name, p.group?.name].filter(Boolean) as string[];
      const viaUsage = keys.some((k) => usage.agents[a]?.projects[k]);
      const viaTower = towerOf(a)?.nodes.some((n) => n.cityphy.project && (samePath(n.cityphy.project, p.root) || (p.group && samePath(n.cityphy.project, p.group.path))));
      if (!viaUsage && !viaTower) continue;
      const line = buildPowerLine(a, p.name, anchors.get(a)!, condo.gate, streets.lamps, color, stage.scene);
      stage.addAnimator(line.animate);
      lines.push(line);
    }
  });

  const homeSpan = Math.max(70, (L.maxZ - L.minZ) * 0.56);
  const center = new THREE.Vector3(-2, 0, (L.minZ + L.maxZ) / 2 - 20);
  const overview = () => stage.fly(center, homeSpan);
  stage.home(center, homeSpan);
  const fly = (x: number, z: number, span: number) => stage.fly(new THREE.Vector3(x, 4, z), span);

  /** Meshes that answer hover and click (rebuilt when the antenna stations arrive). */
  let targets: THREE.Object3D[] = [];
  // State shared by the HUD, sidebar and panel.
  let activity: ActivityReport | null = null;
  const ui = { tab: 'agents' as SideTab, page: 0, project: 0, part: null as string | null, section: 'summary' as ProjectSection, open: null as null | (() => void) };
  const now = () => activity?.generatedAt ?? new Date().toISOString();
  const viewOf = (a: string): AgentView => {
    const last = Object.values(activity?.agents[a] ?? {}).filter(Boolean).sort().at(-1) ?? null;
    return {
      agent: a,
      name: nameOf(a),
      tower: towerOf(a),
      consumption: consumptionOf(a),
      models: usage.agents[a]?.breakdown ?? [],
      powers: [...new Set(lines.filter((l) => l.agent === a).map((l) => l.project))],
      lastActive: last,
      activeNow: !!activity && isActive(last, activity.windowMinutes, activity.generatedAt),
    };
  };
  const feedsOf = (name: string) =>
    lines
      .filter((l) => l.project === name)
      .map((l) => {
        const last = activity?.agents[l.agent]?.[name] ?? null;
        return { agent: l.agent, name: nameOf(l.agent), status: activity && isActive(last, activity.windowMinutes, activity.generatedAt) ? 'ativo agora' : ago(last, now()) };
      });

  const openAgent = (a: string, move = true) => {
    ui.open = () => {
      showAgent(panel, viewOf(a), library, now());
      const c = consumptionOf(a);
      if (a === 'claude' && c) appendCalibration(panel, c, refreshConsumption);
    };
    ui.open();
    const at = L.agents[agents.indexOf(a)];
    if (move) fly(at.x - 4, at.z, 46);
  };
  // Conversations, skills and MCP calls per project: slower to read, so they arrive after the first frame.
  const mcpNames = library.mcps.map((m) => m.name);
  let work: WorkReport = {};
  let index = indexUsage(work, mcpNames);
  const useInfo = (u: Use | undefined) => ({ use: u, measured: index.measured, unmeasured: index.unmeasured });
  const lib = { tab: 'summary' as LibTab, query: '', filter: 'all' };

  const openProject = (i: number, move = true) => {
    if (!projects[i]) return;
    if (i !== ui.project) ui.part = null;
    ui.project = i;
    ui.page = Math.floor(i / PROJECTS_PER_PAGE);
    ui.open = () => {
      const p = projects[ui.project];
      showProjectView(panel, {
        projects,
        index: ui.project,
        part: ui.part,
        section: ui.section,
        work: [...(work[p.name] ?? []), ...(p.group ? (work[p.group.name] ?? []) : [])],
        use: projectUse(index, p.group?.name && work[p.group.name] ? p.group.name : p.name),
        mcpNames,
        economy: economies[ui.project],
        feeds: feedsOf(p.name),
        nameOf,
        color: (n) => hex(colorOf(n)),
        onProject: (k) => openProject(k),
        onPart: (part) => {
          ui.part = part;
          ui.open?.();
        },
        onSection: (sec) => {
          ui.section = sec;
          ui.open?.();
        },
        onSkill: (name) => openSkill(name),
        onMcp: (name) => {
          const k = library.mcps.findIndex((m) => m.name === name);
          if (k >= 0) openMcp(k);
        },
      });
    };
    ui.open();
    if (move) fly(L.projects[i].x, L.projects[i].z, 52);
    renderPanels();
  };
  const openLibrary = (tab: LibTab = lib.tab, move = true) => {
    lib.tab = tab;
    ui.open = () =>
      showLibraryView(panel, {
        lib: library,
        index,
        tab: lib.tab,
        query: lib.query,
        filter: lib.filter,
        nameOf,
        onTab: (t) => openLibrary(t, false),
        onFilter(f, q) {
          const changed = f !== lib.filter;
          lib.filter = f;
          lib.query = q;
          if (changed) ui.open?.();
        },
        onSkill: (name) => openSkill(name),
        onMcp: (k) => openMcp(k),
      });
    ui.open();
    if (move) fly(L.library.x, L.library.z, 50);
  };
  /** A skill from the library or from a project: its copies and where it was used; "‹ Skills" goes back to the list. */
  const openSkill = (name: string) => {
    const skill = library.skills.find((k) => k.name.toLowerCase() === name.toLowerCase());
    ui.open = () => {
      if (skill) showSkill(panel, { skill, shelf: skill.agents.length > 1 ? 'compartilhadas' : `só ${nameOf(skill.agents[0])}` } as Book, nameOf, useInfo(index.skills.get(skill.name.toLowerCase())));
      else {
        const u = index.skills.get(name.toLowerCase());
        panel.innerHTML = `<button class="close" aria-label="Fechar">×</button><p class="kicker">Skill fora da biblioteca</p><h2>${escapeHtml(name)}</h2>
          <p class="muted">Usada nas conversas (${u?.total ?? 0}×), mas não está instalada em nenhuma pasta lida: vem do próprio aplicativo da IA ou de um plugin desligado.</p>`;
        panel.hidden = false;
        panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
      }
      panel.querySelector('.kicker')?.insertAdjacentHTML('beforebegin', '<button class="back" data-back="1">‹ Skills</button>');
      panel.querySelector('[data-back]')?.addEventListener('click', () => openLibrary('skills', false));
    };
    ui.open();
  };
  const openMcp = (i: number, move = true) => {
    ui.open = () => {
      showMcp(panel, { mcp: library.mcps[i] } as Antenna, nameOf, useInfo(index.mcps.get(library.mcps[i].name)));
      panel.querySelector('.kicker')?.insertAdjacentHTML('beforebegin', '<button class="back" data-back="1">‹ MCP</button>');
      panel.querySelector('[data-back]')?.addEventListener('click', () => openLibrary('mcp', false));
    };
    ui.open();
    if (move) fly(L.radio.x, L.radio.z, 56);
  };
  /** After a calibration: new consumption numbers, new glasses, same panel. */
  async function refreshConsumption() {
    const fresh = (await get('/api/consumption')) as ToolConsumption[];
    consumption.splice(0, consumption.length, ...fresh);
    for (const [a, old] of glasses) {
      const c = consumptionOf(a);
      const at = L.agents[agents.indexOf(a)];
      if (!c || !at) continue;
      stage.scene.remove(old);
      const g = buildGlass(c, a, { x: at.x - 12, z: at.z + 4 });
      glasses.set(a, g);
      stage.scene.add(g);
    }
    refreshTargets();
    renderPanels();
    ui.open?.();
    stage.requestRender();
  }

  /** Behind each condominium: the MCP servers that project used (masts, or a radio central above the limit). */
  const usedKey = (p: Project) => (p.group?.name && work[p.group.name] ? p.group.name : p.name);
  function buildStations() {
    projects.forEach((p, i) => {
      const plan = planStation(
        projectUse(index, usedKey(p)).mcps.map(([name, calls]) => {
          const m = library.mcps.find((x) => x.name === name);
          return { name, calls, configured: !!m, transport: m?.transport ?? 'local' };
        }),
      );
      const st = buildStation(p.name, plan, { x: stationX(L.projects[i].x, CONDO_WIDTH), z: L.projects[i].z });
      stage.scene.add(st.group);
      st.animators.forEach((a) => stage.addAnimator(a));
      for (const t of st.tops) {
        const to = radioTops.get(t.name);
        const m = library.mcps.find((x) => x.name === t.name);
        if (to && m) stage.scene.add(radioLink(t.top, to, MCP_COLOR[m.transport]));
      }
    });
    refreshTargets();
    stage.requestRender();
  }

  get('/api/work')
    .then((w: WorkReport) => {
      work = w;
      index = indexUsage(work, mcpNames);
      buildStations();
      if (!panel.hidden && !panel.contains(document.activeElement)) ui.open?.();
    })
    .catch(() => undefined);

  function renderPanels() {
    const views = agents.map(viewOf);
    renderMaqueteHud(document.getElementById('hud')!, views, economies, library, {
      onAgent: (a) => openAgent(a),
      onProjects: () => {
        ui.tab = 'projects';
        openProject(ui.project);
      },
      onLibrary: () => openLibrary('summary'),
    });
    renderSidebar(
      document.getElementById('summary')!,
      { tab: ui.tab, page: ui.page, agents: views, projects, economies, lib: library, now: now(), color: (n) => hex(colorOf(n)) },
      {
        onTab(t) {
          ui.tab = t;
          renderPanels();
        },
        onPage(p) {
          ui.page = p;
          renderPanels();
        },
        onAgent: (a) => openAgent(a),
        onProject: (i) => openProject(i),
        onLibrary: () => openLibrary('summary'),
        onMcp: openMcp,
        onOverview() {
          panel.hidden = true;
          overview();
        },
      },
    );
  }

  const applyActivity = (r: ActivityReport) => {
    activity = r;
    for (const l of lines) l.setOn(isActive(r.agents[l.agent]?.[l.project] ?? null, r.windowMinutes, r.generatedAt));
    stage.requestRender();
    renderPanels();
    if (!panel.hidden && !panel.contains(document.activeElement)) ui.open?.();
  };
  const poll = () => get('/api/activity').then(applyActivity).catch(() => undefined);
  renderPanels();
  await poll();
  setInterval(poll, POLL_MS);

  // Hover and click.
  function refreshTargets() {
    targets = [];
    stage.scene.traverse((o) => o.userData.pick && targets.push(o));
  }
  refreshTargets();
  const ray = new THREE.Raycaster();
  const pickAt = (e: PointerEvent): Pick | null => {
    const r = stage.renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), stage.camera);
    return (ray.intersectObjects(targets, false)[0]?.object.userData.pick as Pick) ?? null;
  };
  const describe = (p: Pick): string => {
    if (p.kind === 'agent') return `<strong>${escapeHtml(nameOf(p.agent))}</strong><br>torre · contexto e memória`;
    if (p.kind === 'glass') {
      const v = blockValues(consumptionOf(p.agent)!);
      return `<strong>${escapeHtml(nameOf(p.agent))} · consumo</strong><br>${v.map((x) => escapeHtml(`${x.label}: ${x.text}`)).join('<br>')}`;
    }
    if (p.kind === 'library') return `<strong>Biblioteca</strong><br>${library.skills.length} skills`;
    if (p.kind === 'station') {
      const used = projectUse(index, usedKey(projects.find((x) => x.name === p.project)!)).mcps;
      const one = used.find(([n]) => n === p.mcp);
      return one
        ? `<strong>${escapeHtml(one[0])}</strong><br>${one[1].toLocaleString('pt-BR')} chamadas em ${escapeHtml(p.project)}${library.mcps.some((m) => m.name === one[0]) ? '' : ' · do aplicativo'}`
        : `<strong>Antenas de ${escapeHtml(p.project)}</strong><br>${used.length} MCP usados`;
    }
    if (p.kind === 'mcp') return `<strong>${escapeHtml(library.mcps[p.index].name)}</strong><br>MCP ${library.mcps[p.index].transport === 'remote' ? 'remoto' : 'local'} · ${library.mcps[p.index].agents.map(nameOf).join(', ')}`;
    return `<strong>${escapeHtml(p.part ?? p.name)}</strong><br>${escapeHtml(p.name)}`;
  };
  let down = { x: 0, y: 0 };
  const canvas = stage.renderer.domElement;
  canvas.addEventListener('pointermove', (e) => {
    const p = pickAt(e);
    canvas.style.cursor = p ? 'pointer' : '';
    tooltip.hidden = !p;
    if (p) {
      tooltip.innerHTML = describe(p);
      tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    }
  });
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
    const p = pickAt(e);
    if (!p) return;
    if (p.kind === 'agent' || p.kind === 'glass') openAgent(p.agent, false);
    else if (p.kind === 'library') openLibrary('summary');
    else if (p.kind === 'mcp') openMcp(p.index);
    else if (p.kind === 'station') {
      const k = library.mcps.findIndex((m) => m.name === p.mcp);
      if (k >= 0) openMcp(k, false);
      else {
        ui.tab = 'projects';
        ui.section = 'tools';
        openProject(projects.findIndex((x) => x.name === p.project), false);
      }
    }
    else {
      const i = projects.findIndex((x) => x.name === p.name);
      ui.project = i;
      ui.part = p.part;
      openProject(i, false);
    }
  });
}

main();
