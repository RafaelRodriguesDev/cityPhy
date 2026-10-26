import * as THREE from 'three';

const Y = 0.07;

/**
 * Inside a condominium, power runs on the ground from the gatehouse to each building's door:
 * out of the gatehouse, along a corridor in front of the buildings, then into the door.
 */
export function buildLotWiring(house: THREE.Vector3, doors: THREE.Vector3[], color: THREE.Color): { group: THREE.Group; curves: THREE.CurvePath<THREE.Vector3>[] } {
  const group = new THREE.Group();
  const curves: THREE.CurvePath<THREE.Vector3>[] = [];
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });

  for (const door of doors) {
    const corridorX = door.x - 1.5;
    const pts = [
      new THREE.Vector3(house.x, Y, house.z),
      new THREE.Vector3(corridorX, Y, house.z),
      new THREE.Vector3(corridorX, Y, door.z),
      new THREE.Vector3(door.x, Y, door.z),
    ];
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < pts.length - 1; i++) if (!pts[i].equals(pts[i + 1])) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
    curves.push(path);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 32, 0.07, 4, false), material));
  }
  return { group, curves };
}
