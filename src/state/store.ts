import { create } from 'zustand';
import type { TextureKind } from '../three/textures';

export type Tool =
  | 'select'
  | 'cube'
  | 'tile'
  | 'stairs'
  | 'slope'
  | 'brush'
  | 'gizmo'
  | 'orbit';

export type RightTab = 'properties' | 'camera' | 'light' | 'render';

export type PrimitiveType = 'cube' | 'tile' | 'stairs' | 'slope';

export type Vec3 = { x: number; y: number; z: number };

export type Primitive = {
  id: string;
  type: PrimitiveType;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  materialId: string | null;
};

export type Material = {
  id: string;
  name: string;
  textureKind: TextureKind;
  color: string;
  secondaryColor?: string;
  roughness: number;
  metalness: number;
};

const DEFAULT_MATERIALS: Material[] = [
  { id: 'def-sky',   name: 'Sky',     textureKind: 'plain',   color: '#8aa2d4', roughness: 0.55, metalness: 0.05 },
  { id: 'def-sand',  name: 'Sand',    textureKind: 'checker', color: '#c4a47a', secondaryColor: '#8a7454', roughness: 0.7, metalness: 0.0 },
  { id: 'def-moss',  name: 'Moss',    textureKind: 'noise',   color: '#8cbfa3', roughness: 0.8, metalness: 0.0 },
  { id: 'def-brick', name: 'Brick',   textureKind: 'brick',   color: '#b38aa8', secondaryColor: '#5a3d54', roughness: 0.75, metalness: 0.0 },
  { id: 'def-sun',   name: 'Sun',     textureKind: 'plain',   color: '#e0d070', roughness: 0.4, metalness: 0.1 },
  { id: 'def-ice',   name: 'Ice',     textureKind: 'plain',   color: '#8ce0e0', roughness: 0.3, metalness: 0.15 },
  { id: 'def-coral', name: 'Coral',   textureKind: 'noise',   color: '#e07a7a', roughness: 0.7, metalness: 0.0 },
  { id: 'def-slate', name: 'Slate',   textureKind: 'checker', color: '#586070', secondaryColor: '#2e3340', roughness: 0.85, metalness: 0.05 },
];

type SceneSlice = {
  primitives: Primitive[];
  selectedIds: string[];
  materials: Record<string, Material>;
  defaultRotationIndex: number;
};

type SceneActions = {
  addPrimitive: (p: Omit<Primitive, 'materialId'> & { materialId?: string | null }) => void;
  updatePrimitive: (id: string, patch: Partial<Primitive>) => void;
  removePrimitive: (id: string) => void;
  setSelection: (ids: string[]) => void;
  addMaterial: (m: Material) => void;
  updateMaterial: (id: string, patch: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
};

type UiSlice = {
  activeTool: Tool;
  activeRightTab: RightTab;
  previewVisible: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  sceneDirty: number;
};

type UiActions = {
  setActiveTool: (t: Tool) => void;
  setActiveRightTab: (t: RightTab) => void;
  togglePreview: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  markSceneDirty: () => void;
};

export type Store = SceneSlice & SceneActions & UiSlice & UiActions;

const seededMaterials: Record<string, Material> = Object.fromEntries(
  DEFAULT_MATERIALS.map((m) => [m.id, m]),
);
const defaultRotationIds = DEFAULT_MATERIALS.map((m) => m.id);

export const useStore = create<Store>((set, get) => ({
  primitives: [],
  selectedIds: [],
  materials: seededMaterials,
  defaultRotationIndex: 0,

  addPrimitive: (input) => {
    const materialId =
      input.materialId !== undefined
        ? input.materialId
        : defaultRotationIds[get().defaultRotationIndex % defaultRotationIds.length];
    set((s) => ({
      primitives: [
        ...s.primitives,
        {
          id: input.id,
          type: input.type,
          position: input.position,
          rotation: input.rotation,
          scale: input.scale,
          materialId,
        },
      ],
      defaultRotationIndex: s.defaultRotationIndex + 1,
      sceneDirty: s.sceneDirty + 1,
    }));
  },
  updatePrimitive: (id, patch) =>
    set((s) => ({
      primitives: s.primitives.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      sceneDirty: s.sceneDirty + 1,
    })),
  removePrimitive: (id) =>
    set((s) => ({
      primitives: s.primitives.filter((p) => p.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
      sceneDirty: s.sceneDirty + 1,
    })),
  setSelection: (ids) => set({ selectedIds: ids }),

  addMaterial: (m) =>
    set((s) => ({ materials: { ...s.materials, [m.id]: m } })),
  updateMaterial: (id, patch) =>
    set((s) => {
      const existing = s.materials[id];
      if (!existing) return s;
      return {
        materials: { ...s.materials, [id]: { ...existing, ...patch } },
        sceneDirty: s.sceneDirty + 1,
      };
    }),
  removeMaterial: (id) =>
    set((s) => {
      const next = { ...s.materials };
      delete next[id];
      return { materials: next };
    }),

  activeTool: 'select',
  activeRightTab: 'properties',
  previewVisible: true,
  showGrid: true,
  snapEnabled: true,
  sceneDirty: 0,

  setActiveTool: (t) => set({ activeTool: t }),
  setActiveRightTab: (t) => set({ activeRightTab: t }),
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  markSceneDirty: () => set((s) => ({ sceneDirty: s.sceneDirty + 1 })),
}));

/** Generates a short unique id for primitives. */
export function nextPrimitiveId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}
