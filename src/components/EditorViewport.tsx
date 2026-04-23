import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  getScene,
  makeEditorCamera,
  createRenderer,
  resizeOrthoCamera,
  updateGridBoundsOverlay,
} from '../three/sceneSetup';
import { getOrCreateGhost, removeGhost } from '../three/ghost';
import { createGhostPool, type GhostPool } from '../three/ghostPool';
import {
  cellSize,
  computeCellDeltas,
  lockedPositions,
  updateDragLock,
  type DragLockState,
} from '../three/placementDrag';
import {
  getPrimitivesGroupObject,
  getSelectableMeshes,
  resolveHit,
} from '../three/sceneSync';
import { createGizmo } from '../three/gizmo';
import { useStore, nextPrimitiveId, type Primitive, type PrimitiveType } from '../state/store';
import { groundPlacement, gridBoundsXZ, withinGridBounds } from '../utils/snap';
import { beginTx, commitTx, record } from '../hooks/useHistory';
import styles from './Viewport.module.css';

const ZOOM_SCALE = 10;
const PLACEMENT_TOOLS: PrimitiveType[] = [
  'cube',
  'tile',
  'stairs',
  'slope',
  'curve',
  'curveHorizontal',
];

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
    // Gesture scheme: scroll = zoom, middle-drag = pan, right-drag = orbit.
    // Left-drag is reserved for the active tool (place / paint / select).
    // Alt+left-drag is a fallback for orbit on one-button/trackpad setups.
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Prevent the browser context menu so right-drag can orbit without interruption.
    const onContextMenu = (ev: MouseEvent) => ev.preventDefault();
    canvas.addEventListener('contextmenu', onContextMenu);

    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointerNDC = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();

    let dragging = false;
    let activeTool = useStore.getState().activeTool;

    type PlacementHit =
      | { onGround: true; x: number; z: number }
      | {
          onGround: false;
          primitiveId: string;
          normalAxis: 'x' | 'y' | 'z';
          normalSign: 1 | -1;
          hitX: number;
          hitZ: number;
        };

    const getPlacementHit = (ev: PointerEvent): PlacementHit | null => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      // Try to hit an existing primitive first so clicks on a cube stack on top.
      const group = getPrimitivesGroupObject();
      const primHits = raycaster.intersectObjects(group.children, false);
      if (primHits.length > 0) {
        const h = primHits[0];
        const resolved = resolveHit(h.object);
        if (resolved?.kind === 'primitive' && h.face) {
          worldNormal
            .copy(h.face.normal)
            .transformDirection(h.object.matrixWorld)
            .normalize();
          // Snap to the nearest cardinal axis so stacking stays axis-aligned.
          const ax = Math.abs(worldNormal.x);
          const ay = Math.abs(worldNormal.y);
          const az = Math.abs(worldNormal.z);
          let axis: 'x' | 'y' | 'z';
          let sign: 1 | -1;
          if (ax >= ay && ax >= az) {
            axis = 'x';
            sign = worldNormal.x >= 0 ? 1 : -1;
          } else if (ay >= az) {
            axis = 'y';
            sign = worldNormal.y >= 0 ? 1 : -1;
          } else {
            axis = 'z';
            sign = worldNormal.z >= 0 ? 1 : -1;
          }
          return {
            onGround: false,
            primitiveId: resolved.id,
            normalAxis: axis,
            normalSign: sign,
            hitX: h.point.x,
            hitZ: h.point.z,
          };
        }
      }
      // Fallback: ground plane at y=0.
      const intersected = raycaster.ray.intersectPlane(groundPlane, hit);
      if (!intersected) return null;
      return { onGround: true, x: hit.x, z: hit.z };
    };

    /** Returns the half-extent of a primitive along a given axis, accounting for scale. */
    const halfExtentAlong = (
      p: { type: PrimitiveType; scale: { x: number; y: number; z: number } },
      axis: 'x' | 'y' | 'z',
    ): number => {
      const baseY = p.type === 'tile' ? 0.125 : 0.5;
      if (axis === 'y') return baseY * p.scale.y;
      return 0.5 * (axis === 'x' ? p.scale.x : p.scale.z);
    };

    /** Base half-extent of a newly placed primitive (scale 1) along an axis. */
    const baseHalfExtent = (type: PrimitiveType, axis: 'x' | 'y' | 'z'): number => {
      if (axis === 'y') return type === 'tile' ? 0.125 : 0.5;
      return 0.5;
    };

    const resolvePlacement = (
      type: PrimitiveType,
      placement: PlacementHit,
    ): { x: number; y: number; z: number } | null => {
      if (placement.onGround) {
        return groundPlacement(type, placement.x, placement.z);
      }
      const s = useStore.getState();
      const hitPrim = s.primitives.find((p) => p.id === placement.primitiveId);
      if (!hitPrim) return null;
      const axis = placement.normalAxis;
      const sign = placement.normalSign;
      const offset = halfExtentAlong(hitPrim, axis) + baseHalfExtent(type, axis);
      const x = hitPrim.position.x + (axis === 'x' ? sign * offset : 0);
      const y = hitPrim.position.y + (axis === 'y' ? sign * offset : 0);
      const z = hitPrim.position.z + (axis === 'z' ? sign * offset : 0);
      return { x, y, z };
    };

    /**
     * Active drag-placement session. Null when not currently placing.
     * Populated on pointerdown over a placement tool; preview ghosts track the lock
     * state; on pointerup all ghost positions commit to real primitives in one tx.
     */
    type PlacementDrag = {
      type: PrimitiveType;
      anchor: { x: number; y: number; z: number };
      downClientX: number;
      downClientY: number;
      lock: DragLockState;
      pool: GhostPool;
      size: { x: number; y: number; z: number };
    };
    let placementDrag: PlacementDrag | null = null;

    /** Drop any preview/commit positions that fall outside the N×N grid bounds (when enabled). */
    const filterByBounds = (
      positions: Array<{ x: number; y: number; z: number }>,
    ): Array<{ x: number; y: number; z: number }> => {
      const s = useStore.getState();
      if (!s.gridBoundsEnabled) return positions;
      return positions.filter((p) => withinGridBounds(p.x, p.z, s.gridBoundsSize));
    };

    const updatePlacementDragGhosts = (drag: PlacementDrag) => {
      const positions = filterByBounds(lockedPositions(drag.anchor, drag.lock, drag.size));
      drag.pool.setPositions(positions, useStore.getState().ghostRotationY);
    };

    const updateGhost = (type: PrimitiveType, placement: PlacementHit) => {
      const pos = resolvePlacement(type, placement);
      if (!pos) return;
      const s = useStore.getState();
      if (s.gridBoundsEnabled && !withinGridBounds(pos.x, pos.z, s.gridBoundsSize)) {
        // Outside the bounded floor — hide the hover preview to signal "can't place here".
        removeGhost(scene);
        return;
      }
      const ghost = getOrCreateGhost(scene, type);
      ghost.position.set(pos.x, pos.y, pos.z);
      ghost.rotation.y = (s.ghostRotationY * Math.PI) / 180;
    };

    const paintedIds = new Set<string>();

    const primitiveAtPointer = (ev: PointerEvent): string | null => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const group = getPrimitivesGroupObject();
      const hits = raycaster.intersectObjects(group.children, false);
      if (hits.length === 0) return null;
      const resolved = resolveHit(hits[0].object);
      return resolved?.kind === 'primitive' ? resolved.id : null;
    };

    const paintAtPointer = (ev: PointerEvent) => {
      const id = primitiveAtPointer(ev);
      if (!id || paintedIds.has(id)) return;
      const materialId = useStore.getState().activeMaterialId;
      if (!materialId) return;
      paintedIds.add(id);
      useStore.getState().updatePrimitive(id, { materialId });
    };

    const erasedIds = new Set<string>();

    /** Removes whatever primitive/cutout is under the pointer, once per stroke. */
    const eraseAtPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(getSelectableMeshes(), false);
      if (hits.length === 0) return;
      const resolved = resolveHit(hits[0].object);
      if (!resolved || erasedIds.has(resolved.id)) return;
      erasedIds.add(resolved.id);
      const s = useStore.getState();
      if (resolved.kind === 'primitive') s.removePrimitive(resolved.id);
      else s.removeCutout(resolved.id);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (placementDrag) {
        // Active mass-placement drag: convert screen delta → per-axis cell deltas,
        // update the lock state machine, and refresh the preview ghosts.
        const rect = canvas.getBoundingClientRect();
        const dx = ev.clientX - placementDrag.downClientX;
        const dy = ev.clientY - placementDrag.downClientY;
        const deltas = computeCellDeltas(
          camera,
          placementDrag.anchor,
          dx,
          dy,
          rect.width,
          rect.height,
          placementDrag.size,
        );
        placementDrag.lock = updateDragLock(placementDrag.lock, deltas);
        updatePlacementDragGhosts(placementDrag);
        return;
      }
      if (activeTool === 'brush' && dragging) {
        paintAtPointer(ev);
        return;
      }
      if (activeTool === 'erase' && dragging) {
        eraseAtPointer(ev);
        return;
      }
      if (isPlacementTool(activeTool) || activeTool === 'cutout') {
        const h = getPlacementHit(ev);
        if (!h) return;
        if (isPlacementTool(activeTool)) {
          updateGhost(activeTool, h);
        }
      }
    };

    const trySelectAtPointer = (ev: PointerEvent): boolean => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(getSelectableMeshes(), false);
      if (hits.length === 0) {
        useStore.getState().setSelection([]);
        return false;
      }
      const resolved = resolveHit(hits[0].object);
      useStore.getState().setSelection(resolved ? [resolved.id] : []);
      return true;
    };

    const placeCutoutAt = (x: number, z: number): string | null => {
      const s = useStore.getState();
      if (!s.activeCutoutImageId) return null;
      const newId = `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      record(() => {
        useStore.getState().addCutout({
          id: newId,
          imageId: s.activeCutoutImageId!,
          position: { x: Math.round(x * 2) / 2, y: 1, z: Math.round(z * 2) / 2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          facing: 'fixed',
          outlineColor: null,
          outlineThickness: 0.04,
        });
      });
      return newId;
    };

    /** True if the click is landing on a visible transform-gizmo handle. */
    const isGizmoClick = (ev: PointerEvent): boolean => {
      const helper = scene.getObjectByName('editorHelper:gizmo');
      if (!helper || !helper.visible) return false;
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      return raycaster.intersectObjects(helper.children, true).length > 0;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      // Alt+left-drag acts as an orbit fallback for one-button/trackpad users.
      if (ev.altKey) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        const restore = () => {
          controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
          window.removeEventListener('pointerup', restore);
        };
        window.addEventListener('pointerup', restore);
        return;
      }
      // If the click is on a gizmo handle, let TransformControls own the event —
      // otherwise we'd either deselect (Select tool) or place through it (placement tools).
      if (isGizmoClick(ev)) return;
      if (activeTool === 'select') {
        ev.stopPropagation();
        trySelectAtPointer(ev);
        return;
      }
      if (activeTool === 'brush') {
        ev.stopPropagation();
        paintedIds.clear();
        dragging = true;
        beginTx();
        paintAtPointer(ev);
        canvas.setPointerCapture(ev.pointerId);
        return;
      }
      if (activeTool === 'erase') {
        ev.stopPropagation();
        erasedIds.clear();
        dragging = true;
        beginTx();
        eraseAtPointer(ev);
        canvas.setPointerCapture(ev.pointerId);
        return;
      }
      const h = getPlacementHit(ev);
      if (!h) return;
      if (activeTool === 'cutout') {
        ev.stopPropagation();
        // Cutouts still place at the ground-hit x/z (they're billboards).
        const cx = h.onGround ? h.x : h.hitX;
        const cz = h.onGround ? h.z : h.hitZ;
        const newId = placeCutoutAt(cx, cz);
        if (newId) {
          // One-shot placement: select the new cutout, switch to Select so
          // the user can tune it via the Properties panel, and surface that tab.
          const s = useStore.getState();
          s.setSelection([newId]);
          s.setActiveTool('select');
          s.setActiveRightTab('properties');
        }
        return;
      }
      if (isPlacementTool(activeTool)) {
        ev.stopPropagation();
        const anchor = resolvePlacement(activeTool, h);
        if (!anchor) return;
        const s = useStore.getState();
        if (s.gridBoundsEnabled && !withinGridBounds(anchor.x, anchor.z, s.gridBoundsSize)) {
          // Clicking outside the bounds is a no-op — no anchor, no preview.
          return;
        }
        // Switch the hover ghost off; the pool owns all preview rendering during a drag.
        removeGhost(scene);
        const pool = createGhostPool(scene, activeTool);
        placementDrag = {
          type: activeTool,
          anchor,
          downClientX: ev.clientX,
          downClientY: ev.clientY,
          lock: { primary: null, secondary: null },
          pool,
          size: cellSize(activeTool),
        };
        updatePlacementDragGhosts(placementDrag);
        dragging = true;
        beginTx();
        canvas.setPointerCapture(ev.pointerId);
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (placementDrag) {
        // Convert preview → real primitives. A zero-lock session (simple click) still
        // yields exactly one position (the anchor), so click-to-place behaviour survives.
        const positions = filterByBounds(
          lockedPositions(placementDrag.anchor, placementDrag.lock, placementDrag.size),
        );
        const ry = useStore.getState().ghostRotationY;
        for (const pos of positions) {
          useStore.getState().addPrimitive({
            id: nextPrimitiveId(),
            type: placementDrag.type,
            position: pos,
            rotation: { x: 0, y: ry, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          });
        }
        placementDrag.pool.dispose();
        placementDrag = null;
      }
      if (dragging) {
        dragging = false;
        paintedIds.clear();
        erasedIds.clear();
        commitTx();
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

    const gizmo = createGizmo({
      camera,
      domElement: canvas,
      scene,
      onDraggingChange: (dragging) => {
        controls.enabled = !dragging;
      },
    });

    const refreshGizmo = () => {
      // Gizmo auto-attaches to any single selected primitive, regardless of tool.
      const state = useStore.getState();
      if (state.selectedIds.length !== 1) {
        gizmo.detach();
        return;
      }
      const id = state.selectedIds[0];
      const primitive = state.primitives.find((p) => p.id === id);
      if (!primitive) {
        gizmo.detach();
        return;
      }
      const group = getPrimitivesGroupObject();
      const mesh = group.children.find(
        (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.primitiveId === id,
      );
      if (!mesh) {
        gizmo.detach();
        return;
      }
      gizmo.attach(mesh, primitive as Primitive);
    };

    const cancelPlacementDrag = () => {
      if (!placementDrag) return;
      placementDrag.pool.dispose();
      placementDrag = null;
      if (dragging) {
        dragging = false;
        commitTx();
      }
    };

    const applyToolState = (tool: typeof activeTool) => {
      activeTool = tool;
      // Left-click is always owned by the active tool — camera uses middle/right.
      controls.mouseButtons.LEFT = null as unknown as THREE.MOUSE;
      if (!isPlacementTool(tool)) {
        cancelPlacementDrag();
        removeGhost(scene);
      }
      refreshGizmo();
    };
    applyToolState(activeTool);

    const syncBoundsOverlay = () => {
      const s = useStore.getState();
      const b = gridBoundsXZ(s.gridBoundsSize);
      updateGridBoundsOverlay(s.gridBoundsEnabled, s.gridBoundsSize, b.min, b.max);
    };
    syncBoundsOverlay();

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
      if (s.selectedIds !== prev.selectedIds || s.primitives !== prev.primitives) {
        refreshGizmo();
      }
      if (s.ghostRotationY !== prev.ghostRotationY && isPlacementTool(activeTool)) {
        const ghost = scene.getObjectByName('ghostPreview');
        if (ghost) ghost.rotation.y = (s.ghostRotationY * Math.PI) / 180;
      }
      if (
        s.gridBoundsEnabled !== prev.gridBoundsEnabled ||
        s.gridBoundsSize !== prev.gridBoundsSize
      ) {
        syncBoundsOverlay();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      gizmo.dispose();
      renderer.dispose();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('contextmenu', onContextMenu);
      cancelPlacementDrag();
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
