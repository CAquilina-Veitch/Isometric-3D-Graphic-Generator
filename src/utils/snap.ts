import type { PrimitiveType } from '../state/store';

export const GRID_STEP: Record<PrimitiveType, { xz: number; y: number }> = {
  cube: { xz: 1.0, y: 1.0 },
  tile: { xz: 1.0, y: 0.25 },
  stairs: { xz: 1.0, y: 1.0 },
  slope: { xz: 1.0, y: 1.0 },
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
