import * as THREE from 'three';
import {
  getScene,
  makeRenderCamera,
  applyIsoAngle,
  applyRenderSettings,
} from '../three/sceneSetup';
import { createPostprocess } from '../three/postprocess';
import { getPrimitivesGroupObject, getCutoutsGroupObject } from '../three/sceneSync';
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Gradient background is composited onto a 2D canvas after render, so when
  // it's on we tell WebGL to clear to transparent and draw the gradient behind.
  const wantsGradient = state.renderState.backgroundGradientEnabled && !opts.shadowOnly;
  renderer.setClearColor(
    new THREE.Color(state.renderState.backgroundColor),
    state.renderState.backgroundTransparent || wantsGradient ? 0 : 1,
  );
  applyRenderSettings(renderer, scene, state.renderState);

  const hiddenHelpers: { obj: THREE.Object3D; prev: boolean }[] = [];
  const swappedMaterials: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];
  const invisibleMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  scene.traverse((obj) => {
    if (obj.userData.editorOnly === true || obj.name === 'gridHelper') {
      if (obj.visible) {
        hiddenHelpers.push({ obj, prev: true });
        obj.visible = false;
      }
    }
  });

  // Post-processing composer for the export render. Shadow-only exports skip
  // the composer entirely — outlines/tilt-shift on invisible meshes are either
  // nonsense or expensive no-ops.
  const post = opts.shadowOnly
    ? null
    : createPostprocess(renderer, scene, camera, width, height);
  if (post) {
    post.setOutlineTargets([
      ...getPrimitivesGroupObject().children,
      ...getCutoutsGroupObject().children,
    ]);
    post.apply(state.renderState);
  }

  try {
    if (opts.shadowOnly) {
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        if (obj.name === 'floor') return;
        swappedMaterials.push({ mesh: obj, material: obj.material });
        obj.material = invisibleMaterial;
      });
    }

    if (post) post.composer.render();
    else renderer.render(scene, camera);

    const finalCanvas = wantsGradient
      ? compositeWithGradient(
          renderer.domElement,
          width,
          height,
          state.renderState.backgroundGradientTop,
          state.renderState.backgroundGradientBottom,
          state.renderState.backgroundGradientStyle,
        )
      : renderer.domElement;

    const blob = await canvasToBlob(finalCanvas);
    downloadBlob(blob, opts.filename ?? defaultFilename(opts.shadowOnly));
  } finally {
    for (const { mesh, material } of swappedMaterials) mesh.material = material;
    invisibleMaterial.dispose();
    for (const { obj, prev } of hiddenHelpers) obj.visible = prev;
    if (post) post.dispose();
    renderer.dispose();
  }
}

function compositeWithGradient(
  webglCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  top: string,
  bottom: string,
  style: 'linear' | 'radial',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for export composite');

  if (style === 'radial') {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) / 2,
    );
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(webglCanvas, 0, 0);
  return canvas;
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
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

function defaultFilename(shadowOnly?: boolean): string {
  const suffix = shadowOnly ? '_shadow' : '';
  return `isometric_scene${suffix}.png`;
}
