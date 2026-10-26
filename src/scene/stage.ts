import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Returns true while it still needs frames (e.g. light pulses running). */
export type Animator = (dt: number) => boolean;

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  requestRender(): void;
  addAnimator(a: Animator): void;
  /** Points the camera at the middle of the city so every lot is in view. */
  frame(center: THREE.Vector3, span: number): void;
}

/** Renderer, camera and an on-demand loop: frames only while something changes. */
export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f17);
  scene.fog = new THREE.Fog(0x0b0f17, 70, 180);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(-22, 34, 52);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(18, 6, -6);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;

  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x141420, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(25, 45, 30);
  scene.add(sun);

  const animators = new Set<Animator>();
  let pending = false;
  let last = performance.now();

  const frame = (now: number) => {
    pending = false;
    // rAF's timestamp can be slightly earlier than `last` on the first frame: never step back.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let again = controls.update();
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
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    requestRender();
  };
  new ResizeObserver(resize).observe(container);
  controls.addEventListener('change', requestRender);
  resize();

  return {
    scene,
    camera,
    renderer,
    controls,
    requestRender,
    addAnimator(a) {
      animators.add(a);
      requestRender();
    },
    frame(center, span) {
      // A narrow screen needs the camera further back to fit the same city.
      const s = Math.max(40, span) * Math.max(1, 1.4 / camera.aspect);
      controls.target.copy(center);
      camera.position.set(center.x - 0.5 * s, center.y + 0.42 * s, center.z + 0.62 * s);
      scene.fog = new THREE.Fog(0x0b0f17, s * 1.2, s * 3.2);
      controls.update();
      requestRender();
    },
  };
}
