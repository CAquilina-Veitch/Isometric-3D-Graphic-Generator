import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  getScene,
  makeRenderCamera,
  createRenderer,
  resizeOrthoCamera,
  setGridVisible,
} from '../three/sceneSetup';
import { useStore } from '../state/store';
import styles from './Viewport.module.css';

const PREVIEW_ZOOM_SCALE = 8;

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

    const camera = makeRenderCamera(w, h);

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
      resizeOrthoCamera(camera, clientWidth, clientHeight, PREVIEW_ZOOM_SCALE);
      requestRender();
    });
    resizeObserver.observe(container);

    const unsubDirty = useStore.subscribe((s, prev) => {
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
