import * as THREE from 'three';
import { shelvesOf } from '../library/buildLibrary.ts';
import type { Library, LibrarySkill, Origin } from '../library/types.ts';
import { makeLabel } from './label.ts';

/** Book color = where the skill came from. */
export const ORIGIN_COLOR: Record<Origin, number> = { user: 0xe0a64a, synced: 0x5fd3ff, plugin: 0x8b7cf6, project: 0x2bb39a };
export const ORIGIN_NAMES: Record<Origin, string> = { user: 'sua (pasta da IA)', synced: 'sincronizada da conta', plugin: 'veio de plugin', project: 'do projeto' };

const PER_ROW = 30;
const CASE_WIDTH = 10;
const CASE_GAP = 2.5;
const ROW_HEIGHT = 0.95;
export const LIBRARY_DEPTH = 1.1;
const DEPTH = LIBRARY_DEPTH;
const BOOK_W = CASE_WIDTH / PER_ROW;
const WOOD = 0x5a4434;

/** One skill: one book. */
export interface Book {
  kind: 'book';
  skill: LibrarySkill;
  shelf: string;
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/** Taller book = heavier SKILL.md (log scale), always shorter than its row. */
const bookHeight = (tokens: number) => Math.min(ROW_HEIGHT - 0.12, 0.42 + 0.18 * Math.log10(1 + tokens / 200));

/** Length (along the street) the library needs for its shelves (one bookcase per shelf). */
export function libraryLength(lib: Library): number {
  const cases = shelvesOf(lib).length;
  return cases ? cases * CASE_WIDTH + (cases - 1) * CASE_GAP : 0;
}

/**
 * The library: one bookcase per shelf (shared skills first, then one per agent), one book per skill,
 * the case as tall as it needs. The cases stand in a row along the street (towards -z from `origin`),
 * their open side facing west, to the main street. `origin.x` is the front of the cases.
 */
export function buildLibrary(lib: Library, origin: { x: number; z: number }): { group: THREE.Group; books: Book[]; mesh: THREE.InstancedMesh | null } {
  const group = new THREE.Group();
  const shelves = shelvesOf(lib);
  const total = shelves.reduce((n, s) => n + s.skills.length, 0);
  if (!total) return { group, books: [], mesh: null };

  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), total);
  const wood = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.9 });
  const books: Book[] = [];
  const m = new THREE.Matrix4();
  let index = 0;

  const cx = origin.x + DEPTH / 2;
  shelves.forEach((shelf, c) => {
    const z0 = origin.z - c * (CASE_WIDTH + CASE_GAP); // north end of this case
    const rows = Math.ceil(shelf.skills.length / PER_ROW);
    const height = rows * ROW_HEIGHT + 0.15;
    const cz = z0 - CASE_WIDTH / 2;
    const board = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      b.position.set(x, y, z);
      group.add(b);
    };
    board(0.1, height, CASE_WIDTH + 0.3, cx + DEPTH / 2, height / 2, cz); // back, to the east
    for (const side of [-1, 1]) board(DEPTH, height, 0.15, cx, height / 2, cz + (side * (CASE_WIDTH + 0.15)) / 2);
    for (let r = 0; r <= rows; r++) board(DEPTH, 0.08, CASE_WIDTH, cx, r * ROW_HEIGHT + 0.04, cz);

    shelf.skills.forEach((skill, i) => {
      const row = Math.floor(i / PER_ROW);
      const h = bookHeight(skill.tokensApprox);
      const z = z0 - (i % PER_ROW) * BOOK_W - BOOK_W / 2;
      m.compose(new THREE.Vector3(cx - 0.05, row * ROW_HEIGHT + 0.08 + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(DEPTH * 0.75, h, BOOK_W * 0.82));
      mesh.setMatrixAt(index, m);
      const color = new THREE.Color(ORIGIN_COLOR[skill.origin]);
      mesh.setColorAt(index, color);
      books.push({ kind: 'book', skill, shelf: shelf.label, mesh, index, color });
      index++;
    });

    const tag = makeLabel(`${shelf.label} · ${shelf.skills.length}`, 0.7);
    tag.position.set(cx, height + 0.7, cz);
    group.add(tag);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  const tallest = Math.max(...shelves.map((s) => Math.ceil(s.skills.length / PER_ROW) * ROW_HEIGHT));
  const title = makeLabel('Biblioteca de skills', 1.2);
  title.position.set(cx, tallest + 2.4, origin.z - libraryLength(lib) / 2);
  group.add(title);
  return { group, books, mesh };
}
