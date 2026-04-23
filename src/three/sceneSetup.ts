import * as THREE from 'three';

const FLOOR_SIZE = 40;
const GRID_DIVISIONS = 40;

let sharedScene: THREE.Scene | null = null;
let gridHelper: THREE.GridHelper | null = null;

export function getScene(): THREE.Scene {
  if (sharedScene) return sharedScene;

  const scene = new THREE.Scene();

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(8, 14, 6);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 1;
  directional.shadow.camera.far = 60;
  directional.shadow.camera.left = -FLOOR_SIZE / 2;
  directional.shadow.camera.right = FLOOR_SIZE / 2;
  directional.shadow.camera.top = FLOOR_SIZE / 2;
  directional.shadow.camera.bottom = -FLOOR_SIZE / 2;
  directional.shadow.bias = -0.0005;
  scene.add(directional);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);

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

export function makeEditorCamera(width: number, height: number): THREE.OrthographicCamera {
  const camera = makeIsoOrthoCamera(width, height, 10);
  camera.position.set(14, 14, 14);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function makeRenderCamera(width: number, height: number): THREE.OrthographicCamera {
  const camera = makeIsoOrthoCamera(width, height, 8);
  applyIsoAngle(camera, 30, 8);
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
