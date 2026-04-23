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
  | 'orbit'
  | 'cutout';

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

export type CutoutImage = {
  id: string;
  name: string;
  textureDataUrl: string;
  width: number;
  height: number;
};

export type Cutout = {
  id: string;
  imageId: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  facing: 'fixed' | 'billboard';
};

export type RenderCameraState = {
  isoAnglePreset: 30 | 45 | 60;
  zoom: number;
};

export type LightState = {
  directionalIntensity: number;
  ambientIntensity: number;
  azimuthDeg: number;
  elevationDeg: number;
  shadowSoftness: number;
};

export type RenderState = {
  backgroundTransparent: boolean;
  backgroundColor: string;
  shadowIntensity: number;
  exportScale: 1 | 2 | 4;
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
  cutouts: Cutout[];
  cutoutImages: Record<string, CutoutImage>;
  activeCutoutImageId: string | null;
  selectedIds: string[];
  materials: Record<string, Material>;
  paletteOrder: string[];
  activeBrushMaterialId: string | null;
  defaultRotationIndex: number;
  renderCameraState: RenderCameraState;
  lightState: LightState;
  renderState: RenderState;
};

type SceneActions = {
  addPrimitive: (p: Omit<Primitive, 'materialId'> & { materialId?: string | null }) => void;
  updatePrimitive: (id: string, patch: Partial<Primitive>) => void;
  removePrimitive: (id: string) => void;
  addCutout: (c: Cutout) => void;
  updateCutout: (id: string, patch: Partial<Cutout>) => void;
  removeCutout: (id: string) => void;
  addCutoutImage: (img: CutoutImage) => void;
  removeCutoutImage: (id: string) => void;
  setActiveCutoutImage: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  addMaterial: (m: Material) => void;
  updateMaterial: (id: string, patch: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  setActiveBrushMaterial: (id: string | null) => void;
  replacePalette: (materials: Material[]) => void;
  updateRenderCamera: (patch: Partial<RenderCameraState>) => void;
  updateLight: (patch: Partial<LightState>) => void;
  updateRender: (patch: Partial<RenderState>) => void;
};

type UiSlice = {
  activeTool: Tool;
  activeRightTab: RightTab;
  previewVisible: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  sceneDirty: number;
  ghostRotationY: number;
};

type UiActions = {
  setActiveTool: (t: Tool) => void;
  setActiveRightTab: (t: RightTab) => void;
  togglePreview: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  markSceneDirty: () => void;
  rotateGhost: () => void;
};

export type Store = SceneSlice & SceneActions & UiSlice & UiActions;

const seededMaterials: Record<string, Material> = Object.fromEntries(
  DEFAULT_MATERIALS.map((m) => [m.id, m]),
);
const defaultRotationIds = DEFAULT_MATERIALS.map((m) => m.id);

export const useStore = create<Store>((set, get) => ({
  primitives: [],
  cutouts: [],
  cutoutImages: {},
  activeCutoutImageId: null,
  selectedIds: [],
  materials: seededMaterials,
  paletteOrder: defaultRotationIds.slice(),
  activeBrushMaterialId: defaultRotationIds[0] ?? null,
  defaultRotationIndex: 0,
  renderCameraState: {
    isoAnglePreset: 30,
    zoom: 8,
  },
  lightState: {
    directionalIntensity: 1.1,
    ambientIntensity: 0.35,
    azimuthDeg: 40,
    elevationDeg: 55,
    shadowSoftness: 1.0,
  },
  renderState: {
    backgroundTransparent: true,
    backgroundColor: '#f0f0f0',
    shadowIntensity: 0.35,
    exportScale: 2,
  },

  addPrimitive: (input) => {
    const order = get().paletteOrder;
    const materialId =
      input.materialId !== undefined
        ? input.materialId
        : order.length > 0
        ? order[get().defaultRotationIndex % order.length]
        : null;
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

  addCutout: (c) =>
    set((s) => ({ cutouts: [...s.cutouts, c], sceneDirty: s.sceneDirty + 1 })),
  updateCutout: (id, patch) =>
    set((s) => ({
      cutouts: s.cutouts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      sceneDirty: s.sceneDirty + 1,
    })),
  removeCutout: (id) =>
    set((s) => ({
      cutouts: s.cutouts.filter((c) => c.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
      sceneDirty: s.sceneDirty + 1,
    })),

  addCutoutImage: (img) =>
    set((s) => ({
      cutoutImages: { ...s.cutoutImages, [img.id]: img },
      activeCutoutImageId: s.activeCutoutImageId ?? img.id,
    })),
  removeCutoutImage: (id) =>
    set((s) => {
      const next = { ...s.cutoutImages };
      delete next[id];
      return {
        cutoutImages: next,
        activeCutoutImageId:
          s.activeCutoutImageId === id ? null : s.activeCutoutImageId,
      };
    }),
  setActiveCutoutImage: (id) => set({ activeCutoutImageId: id }),

  setSelection: (ids) => set({ selectedIds: ids }),

  addMaterial: (m) =>
    set((s) => ({
      materials: { ...s.materials, [m.id]: m },
      paletteOrder: s.paletteOrder.includes(m.id)
        ? s.paletteOrder
        : [...s.paletteOrder, m.id],
    })),
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
      return {
        materials: next,
        paletteOrder: s.paletteOrder.filter((pid) => pid !== id),
        activeBrushMaterialId:
          s.activeBrushMaterialId === id ? null : s.activeBrushMaterialId,
      };
    }),
  setActiveBrushMaterial: (id) => set({ activeBrushMaterialId: id }),
  replacePalette: (materials) =>
    set(() => ({
      materials: Object.fromEntries(materials.map((m) => [m.id, m])),
      paletteOrder: materials.map((m) => m.id),
      activeBrushMaterialId: materials[0]?.id ?? null,
    })),
  updateRenderCamera: (patch) =>
    set((s) => ({
      renderCameraState: { ...s.renderCameraState, ...patch },
      sceneDirty: s.sceneDirty + 1,
    })),
  updateLight: (patch) =>
    set((s) => ({
      lightState: { ...s.lightState, ...patch },
      sceneDirty: s.sceneDirty + 1,
    })),
  updateRender: (patch) =>
    set((s) => ({
      renderState: { ...s.renderState, ...patch },
      sceneDirty: s.sceneDirty + 1,
    })),

  activeTool: 'select',
  activeRightTab: 'properties',
  previewVisible: true,
  showGrid: true,
  snapEnabled: true,
  sceneDirty: 0,
  ghostRotationY: 0,

  setActiveTool: (t) => set({ activeTool: t, ghostRotationY: 0 }),
  setActiveRightTab: (t) => set({ activeRightTab: t }),
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  markSceneDirty: () => set((s) => ({ sceneDirty: s.sceneDirty + 1 })),
  rotateGhost: () => set((s) => ({ ghostRotationY: (s.ghostRotationY + 90) % 360 })),
}));

/** Generates a short unique id for primitives. */
export function nextPrimitiveId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}
