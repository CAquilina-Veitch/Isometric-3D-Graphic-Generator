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
} from '../three/sceneSetup';
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

    const applyBackground = (transparent: boolean, color: string) => {
      renderer.setClearColor(new THREE.Color(color), transparent ? 0 : 1);
    };
    applyBackground(
      initial.renderState.backgroundTransparent,
      initial.renderState.backgroundColor,
    );

    let needsRender = true;
    const requestRender = () => {
      needsRender = true;
    };

    const render = () => {
      const hidden: { obj: THREE.Object3D; prev: boolean }[] = [];
      scene.traverse((obj) => {
        if (obj.userData.editorOnly === true || obj.name === 'gridHelper') {
          if (obj.visible) {
            hidden.push({ obj, prev: true });
            obj.visible = false;
          }
        }
      });
      renderer.render(scene, camera);
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
      resizeOrthoCamera(camera, clientWidth, clientHeight, useStore.getState().renderCameraState.zoom);
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
        applyBackground(
          s.renderState.backgroundTransparent,
          s.renderState.backgroundColor,
        );
        applyFloorShadow(s.renderState.shadowIntensity);
        requestRender();
      }
      if (s.sceneDirty !== prev.sceneDirty) requestRender();
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.dispose();
      unsubDirty();
      // restore grid for editor
      setGridVisible(useStore.getState().showGrid);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.viewport} data-kind="preview">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
