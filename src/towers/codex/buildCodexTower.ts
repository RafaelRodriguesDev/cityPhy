// Builds Codex's tower and writes it as a graphify-compatible graph.json.
// Usage: node src/towers/codex/buildCodexTower.ts [--project <path>]... [--out <dir>]
// Defaults: every project in cityphy.config.json, out = <dataDir>/torre-codex.
import { towerArgs } from '../cli.ts';
import { TowerBuilder } from '../towerBuilder.ts';
import { addGlobalGround, addProjectGround } from './groundFloor.ts';
import { addMemoryFloors } from './memoryFloor.ts';
import { addSessionFloors } from './sessionsFloor.ts';
import { addGlobalSkills, addProjectSkills } from './skillsFloor.ts';
import { codexHome, projectSources } from './sources.ts';

const { projects, out } = towerArgs('codex');
const home = codexHome();
const tower = new TowerBuilder('codex', 'Codex', 8);

addGlobalGround(tower, home);
const globalSkills = addGlobalSkills(tower, home);
const sources = projects.map(projectSources);
for (const project of sources) {
  addProjectGround(tower, project);
  addProjectSkills(tower, project, globalSkills);
  addMemoryFloors(tower, project);
}
addSessionFloors(tower, home, sources);

const graph = tower.build();
const path = tower.write(out);
const annex = graph.nodes.filter((node) => node.cityphy.annex).length;
console.log(
  `[cityphy] torre do Codex: ${graph.nodes.length} andares (${annex} no anexo), ${graph.links.length} cabos, ${projects.length} projeto(s) -> ${path}`,
);

