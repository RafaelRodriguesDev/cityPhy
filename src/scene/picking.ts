import * as THREE from 'three';
import type { Stage } from './stage.ts';

const HOVER = new THREE.Color(0xffffff);

/** Anything drawn as one instance of an InstancedMesh that can be hovered and clicked. */
export interface Pickable {
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/** Hover highlights an instance and reports it; click selects it. */
export function setupPicking<T extends Pickable>(
  stage: Stage,
  meshes: THREE.InstancedMesh[],
  items: T[],
  on: { hover(item: T | null, x: number, y: number): void; select(item: T): void },
): void {
  const byMesh = new Map<THREE.InstancedMesh, T[]>();
  for (const it of items) {
    const list = byMesh.get(it.mesh) ?? [];
    list[it.index] = it;
    byMesh.set(it.mesh, list);
  }
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = stage.renderer.domElement;
  let hovered: T | null = null;
  let queued: PointerEvent | null = null;

  const pick = (e: MouseEvent): T | null => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, stage.camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return byMesh.get(hit.object as THREE.InstancedMesh)?.[hit.instanceId] ?? null;
  };

  const paint = (it: T, c: THREE.Color) => {
    it.mesh.setColorAt(it.index, c);
    if (it.mesh.instanceColor) it.mesh.instanceColor.needsUpdate = true;
  };

  const process = () => {
    const e = queued;
    queued = null;
    if (!e) return;
    const it = pick(e);
    if (it !== hovered) {
      if (hovered) paint(hovered, hovered.color);
      if (it) paint(it, it.color.clone().lerp(HOVER, 0.45));
      hovered = it;
      stage.requestRender();
    }
    canvas.style.cursor = it ? 'pointer' : '';
    on.hover(it, e.clientX, e.clientY);
  };

  canvas.addEventListener('pointermove', (e) => {
    if (!queued) requestAnimationFrame(process);
    queued = e;
  });
  canvas.addEventListener('pointerleave', () => on.hover(null, 0, 0));
  canvas.addEventListener('click', (e) => {
    const it = pick(e);
    if (it) on.select(it);
  });
}
