import * as THREE from 'three';

const FLOOR_SIZE = 40;
const GRID_DIVISIONS = 40;

let sharedScene: THREE.Scene | null = null;
let gridHelper: THREE.GridHelper | null = null;
let ambientLight: THREE.AmbientLight | null = null;
let directionalLight: THREE.DirectionalLight | null = null;
let floorMesh: THREE.Mesh | null = null;

export function getScene(): THREE.Scene {
  if (sharedScene) return sharedScene;

  const scene = new THREE.Scene();

  ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
  directionalLight.position.set(8, 14, 6);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 60;
  directionalLight.shadow.camera.left = -FLOOR_SIZE / 2;
  directionalLight.shadow.camera.right = FLOOR_SIZE / 2;
  directionalLight.shadow.camera.top = FLOOR_SIZE / 2;
  directionalLight.shadow.camera.bottom = -FLOOR_SIZE / 2;
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor';
  scene.add(floorMesh);

  gridHelper = new THREE.GridHelper(FLOOR_SIZE, GRID_DIVISIONS, 0x2a3144, 0x20252f);
  gridHelper.position.y = 0.001;
  gridHelper.name = 'gridHelper';
  scene.add(gridHelper);

  sharedScene = scene;
  return scene;
}

export function setGridVisible(visible: boolean) {
  if (gridHelper) gridHelper.visible = visible;
}

export function applyLightState(state: {
  directionalIntensity: number;
  ambientIntensity: number;
  azimuthDeg: number;
  elevationDeg: number;
}) {
  if (!ambientLight || !directionalLight) return;
  ambientLight.intensity = state.ambientIntensity;
  directionalLight.intensity = state.directionalIntensity;
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
}
