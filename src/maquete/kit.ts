import * as THREE from 'three';

// The maquete look: flat colored faces, thin dark outlines, soft sun shadows.

const EDGE = new THREE.LineBasicMaterial({ color: 0x2b2a27, transparent: true, opacity: 0.7 });
const cache = new Map<string, THREE.MeshLambertMaterial>();

/** Shared flat material per color (and opacity). */
export function paint(color: number, opacity = 1): THREE.MeshLambertMaterial {
  const key = `${color}:${opacity}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    cache.set(key, m);
  }
  return m;
}

/** A mesh with its outline; casts and receives shadows. */
export function solid(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], edges = true): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), EDGE));
  return mesh;
}

/** Box standing on y = `y` with its center at (x, z). */
export function block(w: number, h: number, d: number, color: number | THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = solid(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? paint(color) : color);
  mesh.position.set(x, y + h / 2, z);
  return mesh;
}

/** Gable roof (triangular prism) with its ridge along z, base at y = 0: caps take `wall`, slopes take `roof`. */
export function gable(width: number, rise: number, length: number, wall: number, roof: number): THREE.Mesh {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  geo.translate(0, 0, -length / 2);
  return solid(geo, [paint(wall), paint(roof)]);
}

/** Cylinder from a to b. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number, edges = false): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = solid(new THREE.CylinderGeometry(radius, radius, dir.length(), 6), paint(color), edges);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** Thin dark lines (bracing, wires). */
export function lines(points: THREE.Vector3[], color = 0x4a4843): THREE.LineSegments {
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }));
}

/** Window grid texture for walls: white with rows of gray panes (multiplied by the wall color). */
export function windows(repeatX: number, repeatY: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#8c96a3';
  g.fillRect(10, 18, 18, 26);
  g.fillRect(36, 18, 18, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, Math.round(repeatX)), Math.max(1, Math.round(repeatY)));
  return t;
}

/** Text sign that faces the camera: dark text on a light rounded tag (maquete label). */
export function sign(text: string, scale: number, sub?: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const main = '600 56px system-ui, sans-serif';
  const small = '400 40px system-ui, sans-serif';
  g.font = main;
  const w1 = g.measureText(text).width;
  g.font = small;
  const w2 = sub ? g.measureText(sub).width : 0;
  c.width = Math.ceil(Math.max(w1, w2)) + 48;
  c.height = sub ? 132 : 84;
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.strokeStyle = 'rgba(40,40,36,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(2, 2, c.width - 4, c.height - 4, 18);
  g.fill();
  g.stroke();
  g.textBaseline = 'middle';
  g.fillStyle = '#26251f';
  g.font = main;
  g.fillText(text, 24, 44);
  if (sub) {
    g.fillStyle = '#6b6a63';
    g.font = small;
    g.fillText(sub, 24, 98);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 10;
  s.scale.set((scale * c.width) / c.height, scale, 1);
  return s;
}

/** What a click on a mesh opens. */
export type Pick =
  | { kind: 'agent'; agent: string }
  | { kind: 'glass'; agent: string }
  | { kind: 'library' }
  | { kind: 'mcp'; index: number }
  | { kind: 'project'; name: string; part: string | null }
  | { kind: 'station'; project: string; mcp: string | null };

export function pickable<T extends THREE.Object3D>(o: T, pick: Pick): T {
  o.userData.pick = pick;
  return o;
}
