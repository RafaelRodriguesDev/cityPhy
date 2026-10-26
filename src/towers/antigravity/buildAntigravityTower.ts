// Builds Antigravity's tower and writes it as a graphify-compatible graph.json.
// Usage: node src/towers/antigravity/buildAntigravityTower.ts [--project <path>]... [--out <dir>]
// Defaults: every project in cityphy.config.json, out = <dataDir>/torre-antigravity.
import { towerArgs } from '../cli.ts';
import { TowerBuilder } from '../towerBuilder.ts';
import { addGlobalGround, addProjectGround } from './groundFloor.ts';
import { addMemoryFloors } from './memoryFloor.ts';
import { addSessionFloors } from './sessionsFloor.ts';
import { addGlobalSkills, addProjectSkills } from './skillsFloor.ts';
import { geminiHome, projectSources } from './sources.ts';

const { projects, out } = towerArgs('antigravity');
const home = geminiHome();
const tower = new TowerBuilder('antigravity', 'Antigravity', 8);

addGlobalGround(tower, home);
const globalSkills = addGlobalSkills(tower, home);
for (const project of projects) {
  const p = projectSources(project);
  addProjectGround(tower, p);
  addProjectSkills(tower, p, globalSkills);
  addMemoryFloors(tower, p);
  addSessionFloors(tower, home, p);
}

const graph = tower.build();
const path = tower.write(out);
const annex = graph.nodes.filter((n) => n.cityphy.annex).length;
console.log(
  `[cityphy] torre do Antigravity: ${graph.nodes.length} andares (${annex} no anexo), ${graph.links.length} cabos, ${projects.length} projeto(s) -> ${path}`,
);
