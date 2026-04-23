import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  getScene,
  makeEditorCamera,
  createRenderer,
  resizeOrthoCamera,
} from '../three/sceneSetup';
import { getOrCreateGhost, removeGhost } from '../three/ghost';
import { getPrimitivesGroupObject, primitiveIdFor } from '../three/sceneSync';
import { useStore, nextPrimitiveId, type PrimitiveType } from '../state/store';
import { groundPlacement, gridCellKey } from '../utils/snap';
import styles from './Viewport.module.css';

const ZOOM_SCALE = 10;
const PLACEMENT_TOOLS: PrimitiveType[] = ['cube', 'tile', 'stairs', 'slope'];

function isPlacementTool(t: string): t is PrimitiveType {
  return (PLACEMENT_TOOLS as string[]).includes(t);
}

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

    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointerNDC = new THREE.Vector2();
    const hit = new THREE.Vector3();

    let dragging = false;
    let activeTool = useStore.getState().activeTool;

    const getHit = (ev: PointerEvent): { x: number; z: number } | null => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const intersected = raycaster.ray.intersectPlane(groundPlane, hit);
      if (!intersected) return null;
      return { x: hit.x, z: hit.z };
    };

    const recentCells = new Set<string>();

    const placeAt = (type: PrimitiveType, x: number, z: number) => {
      const pos = groundPlacement(type, x, z);
      const key = gridCellKey(type, pos.x, pos.y, pos.z);
      if (recentCells.has(key)) return;
      recentCells.add(key);
      useStore.getState().addPrimitive({
        id: nextPrimitiveId(),
        type,
        position: pos,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        materialId: null,
      });
    };

    const updateGhost = (type: PrimitiveType, x: number, z: number) => {
      const pos = groundPlacement(type, x, z);
      const ghost = getOrCreateGhost(scene, type);
      ghost.position.set(pos.x, pos.y, pos.z);
    };

    const onPointerMove = (ev: PointerEvent) => {
      const h = getHit(ev);
      if (!h) return;
      if (isPlacementTool(activeTool)) {
        updateGhost(activeTool, h.x, h.z);
        if (dragging) placeAt(activeTool, h.x, h.z);
      }
    };

    const trySelectAtPointer = (ev: PointerEvent): boolean => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const group = getPrimitivesGroupObject();
      const hits = raycaster.intersectObjects(group.children, false);
      if (hits.length === 0) {
        useStore.getState().setSelection([]);
        return false;
      }
      const id = primitiveIdFor(hits[0].object);
      useStore.getState().setSelection(id ? [id] : []);
      return true;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      if (activeTool === 'select') {
        ev.stopPropagation();
        trySelectAtPointer(ev);
        return;
      }
      const h = getHit(ev);
      if (!h) return;
      if (isPlacementTool(activeTool)) {
        ev.stopPropagation();
        recentCells.clear();
        dragging = true;
        placeAt(activeTool, h.x, h.z);
        canvas.setPointerCapture(ev.pointerId);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (dragging) {
        dragging = false;
        recentCells.clear();
        canvas.releasePointerCapture(ev.pointerId);
      }
    };

    const onPointerLeave = () => {
      if (!dragging) removeGhost(scene);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    const applyToolState = (tool: typeof activeTool) => {
      activeTool = tool;
      if (isPlacementTool(tool) || tool === 'select') {
        controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
      } else {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
      if (!isPlacementTool(tool)) removeGhost(scene);
    };
    applyToolState(activeTool);

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

    const unsubStore = useStore.subscribe((s, prev) => {
      if (s.showGrid !== prev.showGrid) {
        const grid = scene.getObjectByName('gridHelper');
        if (grid) grid.visible = s.showGrid;
      }
      if (s.activeTool !== prev.activeTool) applyToolState(s.activeTool);
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      removeGhost(scene);
      unsubStore();
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.viewport} data-kind="editor">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
