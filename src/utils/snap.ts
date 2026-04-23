import type { PrimitiveType } from '../state/store';

export const GRID_STEP: Record<PrimitiveType, { xz: number; y: number }> = {
  cube: { xz: 1.0, y: 1.0 },
  tile: { xz: 1.0, y: 0.25 },
  stairs: { xz: 1.0, y: 1.0 },
  slope: { xz: 1.0, y: 1.0 },
  curve: { xz: 1.0, y: 1.0 },
  curveHorizontal: { xz: 1.0, y: 1.0 },
};

export function snapToGrid(
  value: number,
  step: number,
  offset = 0,
): number {
  return Math.round((value - offset) / step) * step + offset;
}

/** World position where a primitive of this type should sit when placed on y=0. */
export function groundPlacement(
  type: PrimitiveType,
  hitX: number,
  hitZ: number,
): { x: number; y: number; z: number } {
  const stepXZ = GRID_STEP[type].xz;
  const x = Math.floor(hitX / stepXZ) * stepXZ + stepXZ / 2;
  const z = Math.floor(hitZ / stepXZ) * stepXZ + stepXZ / 2;
  const y = groundCenterY(type);
  return { x, y, z };
}

/** Vertical offset so a primitive with its center at this y sits on y=0. */
export function groundCenterY(type: PrimitiveType): number {
  switch (type) {
    case 'cube':
      return 0.5;
    case 'tile':
      return 0.125; // 0.25 thick
    case 'stairs':
    case 'slope':
    case 'curve':
    case 'curveHorizontal':
      return 0.5;
  }
}

/** Stable cell id from a position, used to dedup during drag placement. */
export function gridCellKey(type: PrimitiveType, x: number, y: number, z: number): string {
  const step = GRID_STEP[type];
  return [
    Math.round(x / step.xz),
    Math.round(y / step.y),
    Math.round(z / step.xz),
  ].join(':');
}

/**
 * Axis-aligned XZ bounds for an N-cells-per-side square, aligned to the half-integer
 * snap grid used by groundPlacement. Y is intentionally unbounded.
 *
 *  - For even N the square is centered on the origin.
 *  - For odd N the square is offset by +0.5 on each axis so N cells fit without
 *    splitting (e.g. N=5 → cube centers at {-1.5, -0.5, 0.5, 1.5, 2.5}).
 */
export function gridBoundsXZ(size: number): { min: number; max: number } {
  const lo = -Math.floor(size / 2) + 0.5;
  const hi = lo + size - 1;
  return { min: lo, max: hi };
}

/** Is the given primitive-center XZ position within the N×N grid bounds? */
export function withinGridBounds(x: number, z: number, size: number): boolean {
  const b = gridBoundsXZ(size);
  return x >= b.min && x <= b.max && z >= b.min && z <= b.max;
}
