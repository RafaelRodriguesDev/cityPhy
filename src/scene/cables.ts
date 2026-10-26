import * as THREE from 'three';
import type { TowerLink, TowerRelation } from '../towers/schema.ts';
import type { PlacedFloor } from './towerMesh.ts';

export const RELATION_COLOR: Record<TowerRelation, number> = {
  indexes: 0xf2c46b,
  links_to: 0xc2b6ff,
  lists: 0x6fe8cf,
  loads: 0xffffff,
};
const SEGMENTS = 24;

export interface Cable {
  link: TowerLink;
  curve: THREE.QuadraticBezierCurve3;
  color: THREE.Color;
}

/** Power lines on the tower's front: each link is a cable bowing out from floor to floor. */
export function buildCables(links: TowerLink[], floorsById: Map<string, PlacedFloor>): { object: THREE.LineSegments; cables: Cable[] } {
  const cables: Cable[] = [];
  const positions: number[] = [];
  const colors: number[] = [];

  for (const link of links) {
    const a = floorsById.get(link.source)?.anchor;
    const b = floorsById.get(link.target)?.anchor;
    if (!a || !b) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.z += 1.2 + 0.35 * Math.abs(a.y - b.y);
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    const color = new THREE.Color(RELATION_COLOR[link.relation]);
    cables.push({ link, curve, color });

    const pts = curve.getPoints(SEGMENTS);
    for (let i = 0; i < pts.length - 1; i++) {
      positions.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 });
  return { object: new THREE.LineSegments(geometry, material), cables };
}
