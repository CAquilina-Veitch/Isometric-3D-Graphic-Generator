import * as THREE from 'three';
import type { PrimitiveType } from '../state/store';

export type Axis = 'x' | 'y' | 'z';

export interface LockedAxis {
  axis: Axis;
  /** Signed integer: number of cells past the anchor along this axis. */
  extent: number;
}

export interface DragLockState {
  primary: LockedAxis | null;
  secondary: LockedAxis | null;
}

/** Per-axis fractional cells (signed). */
export interface AxisTriple {
  x: number;
  y: number;
  z: number;
}

/**
 * Signed fractional cells the pointer has travelled along each world axis.
 *  - `raw` is the truthful cell count — use this as the extent once an axis is locked.
 *  - `scored` is `raw` multiplied by a camera-legibility weight in [0, 1]. An axis
 *    pointing near the camera (e.g., world Y in a straight-down view) gets a weight
 *    near zero, so it almost never wins the max-score contest. Use this field when
 *    deciding which axis to lock.
 */
export interface CellDeltas {
  raw: AxisTriple;
  scored: AxisTriple;
}

/** Half-threshold in fractional cells: how far the pointer must drag before an axis locks. */
export const LOCK_THRESHOLD = 0.5;

/**
 * State machine for the mass-placement drag.
 *
 * USER CONTRIBUTION — this function decides how a drag feels.
 *
 * Contract:
 *  - `prev.primary` stays null until some axis's |delta| > LOCK_THRESHOLD. Lock it then.
 *  - Once `primary` is locked, its *axis* is frozen for the rest of the drag.
 *    Only its `extent` updates each frame (Math.round of the fractional delta).
 *  - `prev.secondary` stays null until some OTHER axis's |delta| > LOCK_THRESHOLD.
 *  - Once `secondary` is locked, its axis is also frozen — only its extent updates.
 *  - Must return a NEW object (don't mutate `prev`).
 *
 * Design questions for you to decide:
 *  - Tiebreaking when two axes pass the threshold in the same frame (prefer Y for pillars?
 *    prefer the one with larger |delta|?)
 *  - Extent rounding: Math.round feels natural; Math.trunc is stickier near zero.
 *  - Should a zero-extent axis un-lock? The spec says no — "never release those axis until you let go".
 *
 * Use `deltas.scored[axis]` for max-picking and the threshold test (camera-weighted,
 * so axes facing the camera lose automatically). Use `deltas.raw[axis]` for the
 * actual extent once you've decided to lock.
 *
 * @param prev Current lock state (freshly reset to {null,null} at pointerdown).
 * @param deltas Per-axis fractional cells, raw and camera-weighted.
 * @returns New lock state to render this frame.
 */
export function updateDragLock(prev: DragLockState, deltas: CellDeltas): DragLockState {
  // TODO(user): implement the locking + extent logic described above.
  // Hint: pattern:
  //   1) copy prev
  //   2) if !primary → pick axis with max |deltas.scored[axis]| over threshold, lock it
  //   3) if primary → update primary.extent = Math.round(deltas.raw[primary.axis])
  //   4) if primary && !secondary → pick other axis with max |deltas.scored[axis]| over threshold
  //   5) if secondary → update secondary.extent from deltas.raw
  //   6) return the new state
  void deltas;
  return prev;
}

/** Cell size in world units along each axis, per primitive type. */
export function cellSize(type: PrimitiveType): { x: number; y: number; z: number } {
  return {
    x: 1,
    y: type === 'tile' ? 0.25 : 1,
    z: 1,
  };
}

/** Expand a lock state into the world positions its ghosts should occupy. */
export function lockedPositions(
  anchor: { x: number; y: number; z: number },
  lock: DragLockState,
  size: { x: number; y: number; z: number },
): Array<{ x: number; y: number; z: number }> {
  const range = (extent: number): number[] => {
    const step = extent < 0 ? -1 : 1;
    const out: number[] = [];
    for (let i = 0; i !== extent + step; i += step) out.push(i);
    return out;
  };
  const r1 = lock.primary ? range(lock.primary.extent) : [0];
  const r2 = lock.secondary ? range(lock.secondary.extent) : [0];
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (const i of r1) {
    for (const j of r2) {
      const p = { ...anchor };
      if (lock.primary) p[lock.primary.axis] += i * size[lock.primary.axis];
      if (lock.secondary) p[lock.secondary.axis] += j * size[lock.secondary.axis];
      out.push(p);
    }
  }
  return out;
}

/**
 * Project mouse delta (pixels) onto each world axis to get signed fractional cell counts,
 * plus a camera-legibility-weighted "scored" variant for picking the dominant axis.
 *
 * The weight is `(|s_A| / maxLen)^2` — squared so the falloff is aggressive. An axis
 * pointing straight at the camera (|s_A| → 0) scores ~0 and effectively can't lock,
 * which is what stops vertical placement when the editor is in a top-down view.
 *
 * Recomputed every pointermove so it stays correct if camera zoom/angle changes mid-drag.
 */
export function computeCellDeltas(
  camera: THREE.Camera,
  anchor: { x: number; y: number; z: number },
  mouseDxPx: number,
  mouseDyPx: number,
  viewportWidth: number,
  viewportHeight: number,
  size: { x: number; y: number; z: number },
): CellDeltas {
  const halfW = viewportWidth / 2;
  const halfH = viewportHeight / 2;
  const anchorV = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
  const projAnchor = anchorV.clone().project(camera);
  const anchorPx = { x: projAnchor.x * halfW, y: -projAnchor.y * halfH };

  const perAxis = (axis: Axis): { raw: number; len: number } => {
    const off = anchorV.clone();
    off[axis] += 1;
    const p = off.project(camera);
    const sx = p.x * halfW - anchorPx.x;
    const sy = -p.y * halfH - anchorPx.y;
    const len2 = sx * sx + sy * sy;
    if (len2 === 0) return { raw: 0, len: 0 };
    const worldUnits = (mouseDxPx * sx + mouseDyPx * sy) / len2;
    return { raw: worldUnits / size[axis], len: Math.sqrt(len2) };
  };

  const x = perAxis('x');
  const y = perAxis('y');
  const z = perAxis('z');
  const maxLen = Math.max(x.len, y.len, z.len);
  const weight = (len: number) => (maxLen > 0 ? (len / maxLen) ** 2 : 0);
  const wX = weight(x.len);
  const wY = weight(y.len);
  const wZ = weight(z.len);

  return {
    raw: { x: x.raw, y: y.raw, z: z.raw },
    scored: { x: x.raw * wX, y: y.raw * wY, z: z.raw * wZ },
  };
}
