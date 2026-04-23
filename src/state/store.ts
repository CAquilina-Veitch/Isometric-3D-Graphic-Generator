import { create } from 'zustand';

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

type SceneSlice = {
  primitives: Primitive[];
  selectedIds: string[];
};

type SceneActions = {
  addPrimitive: (p: Primitive) => void;
  updatePrimitive: (id: string, patch: Partial<Primitive>) => void;
  removePrimitive: (id: string) => void;
  setSelection: (ids: string[]) => void;
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

export const useStore = create<Store>((set) => ({
  primitives: [],
  selectedIds: [],

  addPrimitive: (p) =>
    set((s) => ({
      primitives: [...s.primitives, p],
      sceneDirty: s.sceneDirty + 1,
    })),
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
