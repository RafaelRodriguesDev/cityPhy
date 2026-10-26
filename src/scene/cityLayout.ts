// Where things stand in the city. Agent district on the west side of the main street,
// project condominiums on the east side; power lines cross the street. Every lot stays
// behind the sidewalks: nothing may stand on a street.

export const STREET_X = 18;
export const STREET_WIDTH = 8;
export const SIDEWALK = 2;
export const CROSS_STREET_Z = 16;

/** Front edge (towards the cross street) of the first row of lots. */
export const LOT_FRONT_Z = CROSS_STREET_Z - STREET_WIDTH / 2 - SIDEWALK - 2;
const LOT_MARGIN = 3; // grass between fence and buildings
const LOT_GAP = 8; // between two lots along the street

export const TOWER_X = 0;
export const PROJECT_X = 36;

export interface Lot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Side with the gate: the one facing the main street. */
  gate: 'east' | 'west';
}

/** Agent towers: tower (7 wide) with its annex 9 units west of it. */
export function layoutTowers(count: number): Array<{ origin: { x: number; z: number }; lot: Lot }> {
  const half = 3.5 + LOT_MARGIN;
  return Array.from({ length: count }, (_, i) => {
    const maxZ = LOT_FRONT_Z - i * (2 * half + LOT_GAP);
    const z = maxZ - half;
    return {
      origin: { x: TOWER_X, z },
      lot: { minX: TOWER_X - 9 - 3 - LOT_MARGIN, maxX: TOWER_X + half, minZ: z - half, maxZ, gate: 'east' },
    };
  });
}

/** Project condominiums: a row of buildings along z; `rowLengths` is each row's length. */
export function layoutProjects(rowLengths: number[], width: number): Array<{ origin: { x: number; z: number }; lot: Lot }> {
  let front = LOT_FRONT_Z;
  return rowLengths.map((len) => {
    const maxZ = front;
    const minZ = maxZ - len - 2 * LOT_MARGIN;
    front = minZ - LOT_GAP;
    const halfX = width / 2 + LOT_MARGIN;
    return {
      origin: { x: PROJECT_X, z: (maxZ + minZ) / 2 },
      lot: { minX: PROJECT_X - halfX, maxX: PROJECT_X + halfX + 2, minZ, maxZ, gate: 'west' },
    };
  });
}

/** How far the city reaches along the street (for roads and lamps). */
export function cityExtent(lots: Lot[]): { minZ: number; maxZ: number } {
  const deepest = Math.min(0, ...lots.map((l) => l.minZ));
  return { minZ: deepest - 30, maxZ: CROSS_STREET_Z + 30 };
}
