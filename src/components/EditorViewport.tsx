import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  getScene,
  makeEditorCamera,
  createRenderer,
  resizeOrthoCamera,
} from '../three/sceneSetup';
import { useStore } from '../state/store';
import styles from './Viewport.module.css';

const ZOOM_SCALE = 10;

export default function EditorViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) throw new Error('EditorViewport refs missing');

    const scene = getScene();
    const { clientWidth: w, clientHeight: h } = container;
    const renderer = createRenderer(canvas);
    renderer.setSize(w, h, false);

    const camera = makeEditorCamera(w, h);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minZoom = 0.3;
    controls.maxZoom = 4;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    let frame = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight, false);
      resizeOrthoCamera(camera, clientWidth, clientHeight, ZOOM_SCALE);
    });
    resizeObserver.observe(container);

    const unsubGrid = useStore.subscribe((s, prev) => {
      if (s.showGrid !== prev.showGrid) {
        const grid = scene.getObjectByName('gridHelper');
        if (grid) grid.visible = s.showGrid;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      unsubGrid();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.viewport} data-kind="editor">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
