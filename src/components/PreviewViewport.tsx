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
  applyFloorShadow,
  applyRenderSettings,
} from '../three/sceneSetup';
import { createPostprocess } from '../three/postprocess';
import {
  getPrimitivesGroupObject,
  getCutoutsGroupObject,
} from '../three/sceneSync';
import { useStore } from '../state/store';
import styles from './Viewport.module.css';

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
    applyFloorShadow(initial.renderState.shadowIntensity);
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
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight, false);
      resizeOrthoCamera(
        camera,
        clientWidth,
        clientHeight,
        useStore.getState().renderCameraState.zoom,
      );
      post.setSize(clientWidth, clientHeight);
      requestRender();
    });
    resizeObserver.observe(container);

    const unsubDirty = useStore.subscribe((s, prev) => {
      if (s.renderCameraState !== prev.renderCameraState) {
        const rc = s.renderCameraState;
        const { clientWidth, clientHeight } = container;
        resizeOrthoCamera(camera, clientWidth, clientHeight, rc.zoom);
        applyIsoAngle(camera, rc.isoAnglePreset, rc.zoom);
        requestRender();
      }
      if (s.lightState !== prev.lightState) {
        applyLightState(s.lightState);
        requestRender();
      }
      if (s.renderState !== prev.renderState) {
        applyBackground(s.renderState);
        applyFloorShadow(s.renderState.shadowIntensity);
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

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
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
