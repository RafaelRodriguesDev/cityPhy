// Where each piece of the maquete stands. No Three.js here so it can be tested.
// The main street runs along z at x = 0; agents live west of it, the civic district and the projects east.

export interface Spot {
  x: number;
  z: number;
}

export const STREET_HALF = 4;
/** z of the cross street, east of the main one: civic district north of it, projects south. */
export const CROSS_Z = -14;
const AGENT_X = -20;
const AGENT_STEP = 30;
const EAST_X = 24;
const PROJECT_STEP = 34;
/** Half of the deepest lot (the condominium), so nothing reaches a street. */
export const LOT_HALF = 14;

export interface MaqueteLayout {
  agents: Spot[];
  projects: Spot[];
  library: Spot;
  radio: Spot;
  minZ: number;
  maxZ: number;
}

export function maqueteLayout(agentCount: number, projectCount: number): MaqueteLayout {
  const agents = Array.from({ length: agentCount }, (_, i) => ({ x: AGENT_X, z: 6 + i * AGENT_STEP }));
  const projects = Array.from({ length: projectCount }, (_, i) => ({ x: EAST_X, z: CROSS_Z + 6 + LOT_HALF + i * PROJECT_STEP }));
  const library = { x: EAST_X - 2, z: CROSS_Z - 6 - 12 };
  const radio = { x: EAST_X, z: library.z - 34 };
  const last = Math.max(agents.at(-1)?.z ?? 0, projects.at(-1)?.z ?? 0);
  return { agents, projects, library, radio, minZ: radio.z - 26, maxZ: last + LOT_HALF + 12 };
}
