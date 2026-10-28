import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Returns true while it still needs frames. */
export type Animator = (dt: number) => boolean;

export interface MaqueteStage {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  requestRender(): void;
  addAnimator(a: Animator): void;
  /** Sets the whole-city frame (`span` world units tall at zoom 1) and jumps there. */
  home(center: THREE.Vector3, span: number): void;
  /** Glides the camera to look at `center` with about `span` world units in view. */
  fly(center: THREE.Vector3, span: number): void;
  /** Sun shadows cover this z range. */
  setExtent(minZ: number, maxZ: number): void;
}

/** Isometric-like orthographic view, paper background, soft sun. Renders only while something moves. */
export function createMaqueteStage(container: HTMLElement): MaqueteStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1efe8);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
  const VIEW = new THREE.Vector3(1, 0.95, 1).normalize();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minZoom = 0.3;
  controls.maxZoom = 6;
  let span = 120;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b4a6, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const animators = new Set<Animator>();
  let pending = false;
  let last = performance.now();
  let flight: { from: THREE.Vector3; to: THREE.Vector3; zoomFrom: number; zoomTo: number; t: number } | null = null;

  const frame = (now: number) => {
    pending = false;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let again = false;
    if (flight) {
      flight.t = Math.min(1, flight.t + dt / 0.7);
      const k = 1 - Math.pow(1 - flight.t, 3);
      const target = new THREE.Vector3().lerpVectors(flight.from, flight.to, k);
      camera.position.add(new THREE.Vector3().subVectors(target, controls.target));
      controls.target.copy(target);
      camera.zoom = flight.zoomFrom + (flight.zoomTo - flight.zoomFrom) * k;
      camera.updateProjectionMatrix();
      if (flight.t >= 1) flight = null;
      again = true;
    }
    if (controls.update()) again = true;
    for (const a of animators) if (a(dt)) again = true;
    renderer.render(scene, camera);
    if (again) requestRender();
  };
  function requestRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(frame);
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    const aspect = w / Math.max(1, h);
    camera.left = (-span * aspect) / 2;
    camera.right = (span * aspect) / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    requestRender();
  };
  new ResizeObserver(resize).observe(container);
  controls.addEventListener('change', requestRender);

  camera.position.copy(VIEW).multiplyScalar(200);
  resize();

  return {
    scene,
    camera,
    renderer,
    requestRender,
    addAnimator(a) {
      animators.add(a);
      requestRender();
    },
    home(center, s) {
      span = s;
      camera.zoom = 1;
      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(VIEW, 200);
      resize();
    },
    fly(center, s) {
      flight = { from: controls.target.clone(), to: center.clone(), zoomFrom: camera.zoom, zoomTo: Math.min(6, Math.max(0.3, span / s)), t: 0 };
      requestRender();
    },
    setExtent(minZ, maxZ) {
      const mid = (minZ + maxZ) / 2;
      const half = (maxZ - minZ) / 2 + 30;
      sun.position.set(40, 90, mid + 50);
      sun.target.position.set(0, 0, mid);
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 400 });
      sun.shadow.camera.updateProjectionMatrix();
      requestRender();
    },
  };
}
