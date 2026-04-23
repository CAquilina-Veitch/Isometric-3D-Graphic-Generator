import * as THREE from 'three';
import {
  getScene,
  makeRenderCamera,
  applyIsoAngle,
} from '../three/sceneSetup';
import { useStore } from '../state/store';

export type ExportOptions = {
  shadowOnly?: boolean;
  filename?: string;
};

const BASE_WIDTH = 1024;
const BASE_HEIGHT = 1024;

export async function exportPNG(opts: ExportOptions = {}): Promise<void> {
  const state = useStore.getState();
  const scale = state.renderState.exportScale;
  const width = BASE_WIDTH * scale;
  const height = BASE_HEIGHT * scale;

  const scene = getScene();
  const camera = makeRenderCamera(
    width,
    height,
    state.renderCameraState.isoAnglePreset,
    state.renderCameraState.zoom,
  );
  applyIsoAngle(camera, state.renderCameraState.isoAnglePreset, state.renderCameraState.zoom);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(
    new THREE.Color(state.renderState.backgroundColor),
    state.renderState.backgroundTransparent ? 0 : 1,
  );

  const hiddenHelpers: { obj: THREE.Object3D; prev: boolean }[] = [];
  const swappedMaterials: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  const invisibleMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // Hide editor-only helpers (grid, gizmo).
  scene.traverse((obj) => {
    if (obj.userData.editorOnly === true || obj.name === 'gridHelper') {
      if (obj.visible) {
        hiddenHelpers.push({ obj, prev: true });
        obj.visible = false;
      }
    }
  });

  try {
    if (opts.shadowOnly) {
      // Swap every mesh's material for invisible (keeps castShadow → shadow
      // pass still populates the shadow map). Floor is excluded so its
      // ShadowMaterial draws the shadow onto the transparent bg.
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        if (obj.name === 'floor') return;
        swappedMaterials.push({ mesh: obj, material: obj.material });
        obj.material = invisibleMaterial;
      });
    }

    renderer.render(scene, camera);

    const canvas = renderer.domElement;
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, opts.filename ?? defaultFilename(opts.shadowOnly));
  } finally {
    for (const { mesh, material } of swappedMaterials) mesh.material = material;
    invisibleMaterial.dispose();
    for (const { obj, prev } of hiddenHelpers) obj.visible = prev;
    renderer.dispose();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to create PNG blob'));
        else resolve(blob);
      },
      'image/png',
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to kick off the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function defaultFilename(shadowOnly?: boolean): string {
  const suffix = shadowOnly ? '_shadow' : '';
  return `isometric_scene${suffix}.png`;
}
