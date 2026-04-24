import { create } from 'zustand';
import type { TextureKind } from '../three/textures';

export type Tool =
  | 'select'
  | 'cube'
  | 'tile'
  | 'stairs'
  | 'slope'
  | 'curve'
  | 'curveHorizontal'
  | 'brush'
  | 'erase'
  | 'cutout';

export type RightTab = 'properties' | 'camera' | 'light' | 'render';

export type PrimitiveType =
  | 'cube'
  | 'tile'
  | 'stairs'
  | 'slope'
  | 'curve'
  | 'curveHorizontal';

export type Vec3 = { x: number; y: number; z: number };

export type Primitive = {
  id: string;
  type: PrimitiveType;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  materialId: string | null;
};

export type MaterialLighting = 'lit' | 'unlit' | 'emissive';

export type Material = {
  id: string;
  name: string;
  textureKind: TextureKind;
  color: string;
  secondaryColor?: string;
  roughness: number;
  metalness: number;
  /** How the material responds to scene lights. Defaults to 'lit'. */
  lighting?: MaterialLighting;
  /** Emissive strength when lighting === 'emissive'. Defaults to 1. */
  emissiveStrength?: number;
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
  /** Outline halo color behind the cutout. Null = no outline. */
  outlineColor?: string | null;
  /** Outline thickness, normalized 0..0.25. Defaults to 0.04 (~paper thickness). */
  outlineThickness?: number;
};

export type RenderCameraState = {
  isoAnglePreset: 30 | 45 | 60;
  zoom: number;
};

export type LightState = {
  directionalIntensity: number;
  ambientIntensity: number;
  ambientColor: string;
  azimuthDeg: number;
  elevationDeg: number;
  shadowSoftness: number;
  rigEnabled: boolean;
  fillIntensity: number;
  fillColor: string;
  fillAzimuthDeg: number;
  fillElevationDeg: number;
  rimIntensity: number;
  rimColor: string;
  rimAzimuthDeg: number;
  rimElevationDeg: number;
};

export type RenderState = {
  backgroundTransparent: boolean;
  backgroundColor: string;
  shadowIntensity: number;
  exportScale: 1 | 2 | 4;
  tonemapEnabled: boolean;
  exposure: number;
  backgroundGradientEnabled: boolean;
  backgroundGradientTop: string;
  backgroundGradientBottom: string;
  backgroundGradientStyle: 'linear' | 'radial';
  outlineEnabled: boolean;
  outlineColor: string;
  outlineThickness: number;
  outlineStrength: number;
  tiltShiftEnabled: boolean;
  tiltShiftFocusY: number;
  tiltShiftRange: number;
  tiltShiftBlur: number;
  gtaoEnabled: boolean;
  /** How strongly AO darkens — 0 (no effect) … 1 (full). */
  gtaoIntensity: number;
  /** World-space sample radius. Small values = crevice AO; large = soft bowls. */
  gtaoRadius: number;
  /** Max depth difference treated as occluding. Lower = tighter creases. */
  gtaoThickness: number;
};

const DEFAULT_GREY_ID = 'mat-default-grey';

function makeDefaultGreyMaterial(): Material {
  return {
    id: DEFAULT_GREY_ID,
    name: 'Default',
    textureKind: 'plain',
    color: '#8a8a8a',
    roughness: 0.6,
    metalness: 0.05,
  };
}

export type StoredScene = {
  id: string;
  name: string;
  primitives: Primitive[];
  cutouts: Cutout[];
  renderCameraState: RenderCameraState;
  lightState: LightState;
  renderState: RenderState;
};

type SceneSlice = {
  primitives: Primitive[];
  cutouts: Cutout[];
  cutoutImages: Record<string, CutoutImage>;
  activeCutoutImageId: string | null;
  selectedIds: string[];
  materials: Record<string, Material>;
  paletteOrder: string[];
  activeMaterialId: string | null;
  renderCameraState: RenderCameraState;
  lightState: LightState;
  renderState: RenderState;
  projectId: string;
  projectName: string;
  scenes: StoredScene[];
  activeSceneId: string;
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
  setActiveMaterial: (id: string | null) => void;
  replacePalette: (materials: Material[]) => void;
  updateRenderCamera: (patch: Partial<RenderCameraState>) => void;
  updateLight: (patch: Partial<LightState>) => void;
  updateRender: (patch: Partial<RenderState>) => void;
  addScene: (name?: string) => void;
  removeScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  switchScene: (id: string) => void;
  setProjectName: (name: string) => void;
  newProject: () => void;
  loadProjectData: (data: ProjectData) => void;
};

export type ProjectData = {
  id: string;
  name: string;
  scenes: StoredScene[];
  activeSceneId: string;
  cutoutImages: Record<string, CutoutImage>;
  schemaVersion: number;
};

type UiSlice = {
  activeTool: Tool;
  activeRightTab: RightTab;
  previewVisible: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  sceneDirty: number;
  ghostRotationY: number;
  helpOpen: boolean;
  /** When true, placement is restricted to a gridBoundsSize × gridBoundsSize square in XZ. */
  gridBoundsEnabled: boolean;
  /** Number of 1-unit cells per side of the bounding square. Infinite in Y. */
  gridBoundsSize: number;
};

type UiActions = {
  setActiveTool: (t: Tool) => void;
  setActiveRightTab: (t: RightTab) => void;
  togglePreview: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  markSceneDirty: () => void;
  rotateGhost: () => void;
  toggleHelp: () => void;
  setGridBoundsEnabled: (enabled: boolean) => void;
  setGridBoundsSize: (size: number) => void;
};

export type Store = SceneSlice & SceneActions & UiSlice & UiActions;

const initialGrey = makeDefaultGreyMaterial();
const seededMaterials: Record<string, Material> = { [initialGrey.id]: initialGrey };
const seededPaletteOrder = [initialGrey.id];

const DEFAULT_RENDER_CAMERA: RenderCameraState = {
  isoAnglePreset: 30,
  zoom: 8,
};

const DEFAULT_LIGHT: LightState = {
  // Three.js ≥0.155 uses physically-correct light intensities (≈π× smaller scale
  // than pre-r155). Defaults here are ~π× the old look so new scenes read bright.
  directionalIntensity: 3.5,
  ambientIntensity: 1.1,
  ambientColor: '#ffffff',
  azimuthDeg: 40,
  elevationDeg: 55,
  shadowSoftness: 1.0,
  // Three-point rig — off by default. Classic ratio: key:fill:rim = 1:0.3:0.7.
  rigEnabled: false,
  fillIntensity: 1.2,
  fillColor: '#cfe1ff',
  fillAzimuthDeg: 220,
  fillElevationDeg: 30,
  rimIntensity: 2.5,
  rimColor: '#ffe3c2',
  rimAzimuthDeg: 220,
  rimElevationDeg: 20,
};

const DEFAULT_RENDER: RenderState = {
  backgroundTransparent: true,
  backgroundColor: '#f0f0f0',
  shadowIntensity: 0.35,
  exportScale: 2,
  tonemapEnabled: false,
  exposure: 1.0,
  backgroundGradientEnabled: false,
  backgroundGradientTop: '#e8ecf4',
  backgroundGradientBottom: '#a7b2c4',
  backgroundGradientStyle: 'linear',
  outlineEnabled: false,
  outlineColor: '#1a1a1a',
  outlineThickness: 2.0,
  outlineStrength: 3.0,
  tiltShiftEnabled: false,
  tiltShiftFocusY: 0.5,
  tiltShiftRange: 0.15,
  tiltShiftBlur: 3.0,
  gtaoEnabled: false,
  gtaoIntensity: 0.6,
  gtaoRadius: 0.25,
  gtaoThickness: 1.0,
};

function makeEmptyScene(name: string): StoredScene {
  return {
    id: `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    primitives: [],
    cutouts: [],
    renderCameraState: { ...DEFAULT_RENDER_CAMERA },
    lightState: { ...DEFAULT_LIGHT },
    renderState: { ...DEFAULT_RENDER },
  };
}

const initialScene = makeEmptyScene('Scene 1');

function snapshotCurrent(s: Store): StoredScene[] {
  return s.scenes.map((sc) =>
    sc.id === s.activeSceneId
      ? {
          ...sc,
          primitives: s.primitives,
          cutouts: s.cutouts,
          renderCameraState: s.renderCameraState,
          lightState: s.lightState,
          renderState: s.renderState,
        }
      : sc,
  );
}

export const useStore = create<Store>((set, get) => ({
  primitives: [],
  cutouts: [],
  cutoutImages: {},
  activeCutoutImageId: null,
  selectedIds: [],
  materials: seededMaterials,
  paletteOrder: seededPaletteOrder.slice(),
  activeMaterialId: seededPaletteOrder[0] ?? null,
  renderCameraState: { ...DEFAULT_RENDER_CAMERA },
  lightState: { ...DEFAULT_LIGHT },
  renderState: { ...DEFAULT_RENDER },
  projectId: `proj-${Date.now().toString(36)}`,
  projectName: 'Untitled Project',
  scenes: [initialScene],
  activeSceneId: initialScene.id,

  addPrimitive: (input) => {
    const materialId =
      input.materialId !== undefined ? input.materialId : get().activeMaterialId;
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
      const nextOrder = s.paletteOrder.filter((pid) => pid !== id);
      return {
        materials: next,
        paletteOrder: nextOrder,
        activeMaterialId:
          s.activeMaterialId === id
            ? nextOrder[0] ?? null
            : s.activeMaterialId,
      };
    }),
  setActiveMaterial: (id) => set({ activeMaterialId: id }),
  replacePalette: (materials) =>
    set(() => ({
      materials: Object.fromEntries(materials.map((m) => [m.id, m])),
      paletteOrder: materials.map((m) => m.id),
      activeMaterialId: materials[0]?.id ?? null,
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
  addScene: (name) =>
    set((s) => {
      const next = makeEmptyScene(name ?? `Scene ${s.scenes.length + 1}`);
      const snapshotted = snapshotCurrent(s);
      return {
        scenes: [...snapshotted, next],
        activeSceneId: next.id,
        primitives: next.primitives,
        cutouts: next.cutouts,
        renderCameraState: next.renderCameraState,
        lightState: next.lightState,
        renderState: next.renderState,
        selectedIds: [],
        sceneDirty: s.sceneDirty + 1,
      };
    }),
  removeScene: (id) =>
    set((s) => {
      if (s.scenes.length <= 1) return s;
      const remaining = s.scenes.filter((sc) => sc.id !== id);
      if (s.activeSceneId === id) {
        const next = remaining[0];
        return {
          scenes: remaining,
          activeSceneId: next.id,
          primitives: next.primitives,
          cutouts: next.cutouts,
          renderCameraState: next.renderCameraState,
          lightState: next.lightState,
          renderState: next.renderState,
          selectedIds: [],
          sceneDirty: s.sceneDirty + 1,
        };
      }
      return { scenes: remaining };
    }),
  renameScene: (id, name) =>
    set((s) => ({
      scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, name } : sc)),
    })),
  switchScene: (id) =>
    set((s) => {
      if (id === s.activeSceneId) return s;
      const snapshotted = snapshotCurrent(s);
      const target = snapshotted.find((sc) => sc.id === id);
      if (!target) return s;
      return {
        scenes: snapshotted,
        activeSceneId: id,
        primitives: target.primitives,
        cutouts: target.cutouts,
        renderCameraState: target.renderCameraState,
        lightState: target.lightState,
        renderState: target.renderState,
        selectedIds: [],
        sceneDirty: s.sceneDirty + 1,
      };
    }),
  setProjectName: (name) => set({ projectName: name }),
  newProject: () =>
    set(() => {
      const scene = makeEmptyScene('Scene 1');
      const grey = makeDefaultGreyMaterial();
      return {
        projectId: `proj-${Date.now().toString(36)}`,
        projectName: 'Untitled Project',
        scenes: [scene],
        activeSceneId: scene.id,
        primitives: scene.primitives,
        cutouts: scene.cutouts,
        cutoutImages: {},
        activeCutoutImageId: null,
        materials: { [grey.id]: grey },
        paletteOrder: [grey.id],
        activeMaterialId: grey.id,
        renderCameraState: scene.renderCameraState,
        lightState: scene.lightState,
        renderState: scene.renderState,
        selectedIds: [],
        sceneDirty: 1,
      };
    }),
  loadProjectData: (data) =>
    set(() => {
      // Fill any fields missing from older saved files with current defaults so
      // new rig / post-processing settings don't arrive as undefined.
      const migrated = data.scenes.map((sc) => ({
        ...sc,
        lightState: { ...DEFAULT_LIGHT, ...sc.lightState },
        renderState: { ...DEFAULT_RENDER, ...sc.renderState },
      }));
      const active = migrated.find((sc) => sc.id === data.activeSceneId) ?? migrated[0];
      if (!active) return {};
      return {
        projectId: data.id,
        projectName: data.name,
        scenes: migrated,
        activeSceneId: active.id,
        primitives: active.primitives,
        cutouts: active.cutouts,
        cutoutImages: data.cutoutImages,
        activeCutoutImageId: Object.keys(data.cutoutImages)[0] ?? null,
        renderCameraState: active.renderCameraState,
        lightState: active.lightState,
        renderState: active.renderState,
        selectedIds: [],
        sceneDirty: 1,
      };
    }),

  activeTool: 'select',
  activeRightTab: 'properties',
  previewVisible: true,
  showGrid: true,
  snapEnabled: true,
  sceneDirty: 0,
  ghostRotationY: 0,
  helpOpen: false,
  gridBoundsEnabled: false,
  gridBoundsSize: 10,

  setActiveTool: (t) =>
    set((s) => ({
      activeTool: t,
      ghostRotationY: 0,
      // Switching away from Select clears the selection so the gizmo goes away
      // and placement/brush/erase don't feel tied to the previously-picked object.
      selectedIds: t === 'select' ? s.selectedIds : [],
    })),
  setActiveRightTab: (t) => set({ activeRightTab: t }),
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  markSceneDirty: () => set((s) => ({ sceneDirty: s.sceneDirty + 1 })),
  rotateGhost: () => set((s) => ({ ghostRotationY: (s.ghostRotationY + 90) % 360 })),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),
  setGridBoundsEnabled: (enabled) => set({ gridBoundsEnabled: enabled }),
  setGridBoundsSize: (size) => set({ gridBoundsSize: Math.max(1, Math.round(size)) }),
}));

/** Generates a short unique id for primitives. */
export function nextPrimitiveId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}
