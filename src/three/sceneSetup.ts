import * as THREE from 'three';

const FLOOR_SIZE = 40;
const GRID_DIVISIONS = 40;
const BOUNDS_NAME = 'gridBoundsOverlay';

let sharedScene: THREE.Scene | null = null;
let gridHelper: THREE.GridHelper | null = null;
let ambientLight: THREE.AmbientLight | null = null;
let directionalLight: THREE.DirectionalLight | null = null;
let floorMesh: THREE.Mesh | null = null;
let boundsOverlay: THREE.LineSegments | null = null;

export function getScene(): THREE.Scene {
  if (sharedScene) return sharedScene;

  const scene = new THREE.Scene();

  // Initial values match DEFAULT_LIGHT in store.ts — physically-correct lighting
  // (three.js ≥r155) needs ~π× the numeric intensity of the pre-r155 scale.
  ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 3.5);
  directionalLight.position.set(8, 14, 6);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 60;
  directionalLight.shadow.camera.left = -FLOOR_SIZE / 2;
  directionalLight.shadow.camera.right = FLOOR_SIZE / 2;
  directionalLight.shadow.camera.top = FLOOR_SIZE / 2;
  directionalLight.shadow.camera.bottom = -FLOOR_SIZE / 2;
  // Small constant bias to suppress acne, plus a normal-offset bias so
  // concave corners (e.g. tread meeting riser on stairs) don't leak light.
  directionalLight.shadow.bias = -0.00005;
  directionalLight.shadow.normalBias = 0.04;
  scene.add(directionalLight);

  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor';
  scene.add(floorMesh);

  gridHelper = new THREE.GridHelper(FLOOR_SIZE, GRID_DIVISIONS, 0x8a7d68, 0xb7a98d);
  gridHelper.position.y = 0.001;
  gridHelper.name = 'gridHelper';
  scene.add(gridHelper);

  sharedScene = scene;
  return scene;
}

export function setGridVisible(visible: boolean) {
  if (gridHelper) gridHelper.visible = visible;
}

/**
 * Draw a bright outline around the N×N cell area that placements are restricted to.
 * Hides when `enabled` is false. Extent is aligned to the same half-integer snap
 * grid that groundPlacement uses, so the overlay and actual placements line up.
 */
export function updateGridBoundsOverlay(
  enabled: boolean,
  size: number,
  minCenter: number,
  maxCenter: number,
) {
  if (!sharedScene) return;
  if (!enabled) {
    if (boundsOverlay) boundsOverlay.visible = false;
    return;
  }
  if (!boundsOverlay) {
    const material = new THREE.LineBasicMaterial({
      color: 0x5aa1ff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: false,
    });
    const geometry = new THREE.BufferGeometry();
    boundsOverlay = new THREE.LineSegments(geometry, material);
    boundsOverlay.name = BOUNDS_NAME;
    boundsOverlay.renderOrder = 998;
    boundsOverlay.userData.editorOnly = true;
    sharedScene.add(boundsOverlay);
  }
  // Rebuild geometry to match the current bound size. LineSegments expects pairs
  // of vertices per line, so the square is 4 edges = 8 vertices.
  const lo = minCenter - 0.5;
  const hi = maxCenter + 0.5;
  const y = 0.002;
  const v = new Float32Array([
    lo, y, lo, hi, y, lo,
    hi, y, lo, hi, y, hi,
    hi, y, hi, lo, y, hi,
    lo, y, hi, lo, y, lo,
  ]);
  void size;
  boundsOverlay.geometry.dispose();
  boundsOverlay.geometry = new THREE.BufferGeometry();
  boundsOverlay.geometry.setAttribute('position', new THREE.BufferAttribute(v, 3));
  boundsOverlay.visible = true;
}

export function applyLightState(state: {
  directionalIntensity: number;
  ambientIntensity: number;
  ambientColor?: string;
  azimuthDeg: number;
  elevationDeg: number;
  shadowSoftness?: number;
}) {
  if (!ambientLight || !directionalLight) return;
  ambientLight.intensity = state.ambientIntensity;
  ambientLight.color.set(state.ambientColor ?? '#ffffff');
  directionalLight.intensity = state.directionalIntensity;
  // shadow.radius is the PCF blur radius; only has an effect with
  // PCFSoftShadowMap (which we use). Slider 0..3 → radius 0..12.
  directionalLight.shadow.radius = Math.max(0, (state.shadowSoftness ?? 1) * 4);
  const az = (state.azimuthDeg * Math.PI) / 180;
  const el = (state.elevationDeg * Math.PI) / 180;
  const distance = 14;
  directionalLight.position.set(
    distance * Math.cos(el) * Math.sin(az),
    distance * Math.sin(el),
    distance * Math.cos(el) * Math.cos(az),
  );
}

export function applyFloorShadow(intensity: number) {
  if (!floorMesh) return;
  const material = floorMesh.material as THREE.ShadowMaterial;
  material.opacity = intensity;
}

export function makeEditorCamera(width: number, height: number): THREE.OrthographicCamera {
  const camera = makeIsoOrthoCamera(width, height, 10);
  camera.position.set(14, 14, 14);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function makeRenderCamera(
  width: number,
  height: number,
  angleDegrees = 30,
  zoomScale = 8,
): THREE.OrthographicCamera {
  const camera = makeIsoOrthoCamera(width, height, zoomScale);
  applyIsoAngle(camera, angleDegrees, zoomScale);
  return camera;
}

function makeIsoOrthoCamera(width: number, height: number, zoomScale: number) {
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    -zoomScale * aspect,
    zoomScale * aspect,
    zoomScale,
    -zoomScale,
    -100,
    100,
  );
  return camera;
}

export function applyIsoAngle(
  camera: THREE.OrthographicCamera,
  angleDegrees: number,
  distance: number,
) {
  const rad = (angleDegrees * Math.PI) / 180;
  const horiz = distance * Math.cos(rad);
  const vert = distance * Math.sin(rad);
  const diagonal = horiz / Math.SQRT2;
  camera.position.set(diagonal, vert, diagonal);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

export function resizeOrthoCamera(
  camera: THREE.OrthographicCamera,
  width: number,
  height: number,
  zoomScale: number,
) {
  const aspect = width / height;
  camera.left = -zoomScale * aspect;
  camera.right = zoomScale * aspect;
  camera.top = zoomScale;
  camera.bottom = -zoomScale;
  camera.updateProjectionMatrix();
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap so shadow.radius (driven by the Light tab's softness slider)
  // actually controls blur. Normal-bias on the directional light handles acne/leak.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function disposeSharedScene() {
  if (!sharedScene) return;
  sharedScene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose();
    }
  });
  sharedScene = null;
  gridHelper = null;
  boundsOverlay = null;
}
