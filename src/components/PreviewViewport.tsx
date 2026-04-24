import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  getScene,
  makeRenderCamera,
  createRenderer,
  resizeOrthoCamera,
  setGridVisible,
  applyIsoAngle,
  applyLightState,
  applyShadowIntensity,
  applyRenderSettings,
} from '../three/sceneSetup';
import { createPostprocess } from '../three/postprocess';
import {
  getPrimitivesGroupObject,
  getCutoutsGroupObject,
} from '../three/sceneSync';
import { useStore } from '../state/store';
import styles from './Viewport.module.css';

// Transient preview view — zoom multiplier and world-space pan offset live
// here in component memory, never in the Zustand store. That's intentional:
// the user wants to peek around the scene without changing what the PNG
// export produces. Exports read `renderCameraState` directly, so they're
// naturally unaffected by whatever we do to the preview camera.
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;

export default function PreviewViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) throw new Error('PreviewViewport refs missing');

    const scene = getScene();
    const { clientWidth: w, clientHeight: h } = container;
    const renderer = createRenderer(canvas);
    renderer.setSize(w, h, false);

    const initial = useStore.getState();
    const camera = makeRenderCamera(
      w,
      h,
      initial.renderCameraState.isoAnglePreset,
      initial.renderCameraState.zoom,
    );
    applyLightState(initial.lightState);
    applyShadowIntensity(initial.renderState.shadowIntensity);
    applyRenderSettings(renderer, scene, initial.renderState);

    const post = createPostprocess(renderer, scene, camera, w, h);
    post.apply(initial.renderState);

    const refreshOutlineTargets = () => {
      // Outline everything that renders in the preview (primitives + cutouts).
      // If per-material outlining is added later, filter here.
      post.setOutlineTargets([
        ...getPrimitivesGroupObject().children,
        ...getCutoutsGroupObject().children,
      ]);
    };
    refreshOutlineTargets();

    const applyBackground = (state: typeof initial.renderState) => {
      // Gradient wins when enabled: canvas goes alpha=0 and the container's
      // inline gradient shows through. Otherwise fall back to the existing
      // transparent/solid-color behaviour.
      if (state.backgroundGradientEnabled) {
        renderer.setClearColor(0x000000, 0);
        const shape =
          state.backgroundGradientStyle === 'radial'
            ? `radial-gradient(ellipse at center, ${state.backgroundGradientTop} 0%, ${state.backgroundGradientBottom} 100%)`
            : `linear-gradient(180deg, ${state.backgroundGradientTop} 0%, ${state.backgroundGradientBottom} 100%)`;
        container.style.background = shape;
        return;
      }
      container.style.background = '';
      renderer.setClearColor(
        new THREE.Color(state.backgroundColor),
        state.backgroundTransparent ? 0 : 1,
      );
    };
    applyBackground(initial.renderState);

    let needsRender = true;
    const requestRender = () => {
      needsRender = true;
    };

    // Transient view state. viewZoom multiplies the base zoom (wheel scrolls),
    // panOffset shifts the camera and its lookAt target by the same world
    // vector so the view direction is preserved — we translate, we don't orbit.
    let viewZoom = 1;
    const panOffset = new THREE.Vector3();

    const applyView = () => {
      const rc = useStore.getState().renderCameraState;
      const { clientWidth, clientHeight } = container;
      // Ortho "zoom" is an inverse: smaller frustum = more zoomed in. So
      // dividing by viewZoom means viewZoom > 1 = zoomed in.
      const effective = rc.zoom / viewZoom;
      resizeOrthoCamera(camera, clientWidth, clientHeight, effective);
      applyIsoAngle(camera, rc.isoAnglePreset, effective);
      camera.position.add(panOffset);
      camera.lookAt(panOffset);
      camera.updateProjectionMatrix();
      requestRender();
    };

    const resetView = () => {
      viewZoom = 1;
      panOffset.set(0, 0, 0);
      applyView();
    };

    const render = () => {
      // Hide editor-only helpers (grid, bounds overlay) during the render pass
      // so they don't land in the final image or the PNG export.
      const hidden: { obj: THREE.Object3D; prev: boolean }[] = [];
      scene.traverse((obj) => {
        if (obj.userData.editorOnly === true || obj.name === 'gridHelper') {
          if (obj.visible) {
            hidden.push({ obj, prev: true });
            obj.visible = false;
          }
        }
      });
      post.composer.render();
      for (const { obj, prev } of hidden) obj.visible = prev;
    };

    let frame = 0;
    const tick = () => {
      if (needsRender) {
        render();
        needsRender = false;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      applyView();
    });
    resizeObserver.observe(container);

    // --- Interactive pan/zoom (transient, preview-only) ---

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Exponential zoom feels uniform at every scale — 1 tick = 1 ratio.
      const factor = Math.exp(-e.deltaY * 0.001);
      viewZoom = THREE.MathUtils.clamp(viewZoom * factor, ZOOM_MIN, ZOOM_MAX);
      applyView();
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const isPanGesture = (e: PointerEvent) =>
      e.button === 1 || (e.button === 0 && e.shiftKey);

    const handlePointerDown = (e: PointerEvent) => {
      if (!isPanGesture(e)) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Convert pixel delta to world delta using the ortho frustum extent.
      // Then project onto the camera's local right/up so the pan follows the
      // screen even though the camera is tilted for iso.
      const { clientWidth, clientHeight } = container;
      const worldPerPxX = (camera.right - camera.left) / clientWidth;
      const worldPerPxY = (camera.top - camera.bottom) / clientHeight;

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

      panOffset
        .addScaledVector(right, -dx * worldPerPxX)
        .addScaledVector(up, dy * worldPerPxY);
      applyView();
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      canvas.style.cursor = '';
    };

    const handleDoubleClick = () => resetView();
    const handleContextMenu = (e: MouseEvent) => {
      // Middle-click on some OSes opens context menus — suppress during drag.
      if (dragging) e.preventDefault();
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);

    const unsubDirty = useStore.subscribe((s, prev) => {
      // Camera settings from the Camera tab are an intentional recompose —
      // drop the transient pan/zoom so the user sees the new composition as-is.
      if (s.renderCameraState !== prev.renderCameraState) {
        resetView();
      }
      // Swapping scenes loads a fresh composition too; reset so we're not
      // peering at an off-center region of a scene we just loaded.
      if (s.activeSceneId !== prev.activeSceneId) {
        resetView();
      }
      if (s.lightState !== prev.lightState) {
        applyLightState(s.lightState);
        requestRender();
      }
      if (s.renderState !== prev.renderState) {
        applyBackground(s.renderState);
        applyShadowIntensity(s.renderState.shadowIntensity);
        applyRenderSettings(renderer, scene, s.renderState);
        post.apply(s.renderState);
        requestRender();
      }
      if (s.primitives !== prev.primitives || s.cutouts !== prev.cutouts) {
        refreshOutlineTargets();
        requestRender();
      }
      if (s.sceneDirty !== prev.sceneDirty) requestRender();
    });

    applyView();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      post.dispose();
      renderer.dispose();
      unsubDirty();
      container.style.background = '';
      setGridVisible(useStore.getState().showGrid);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.viewport} data-kind="preview">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
