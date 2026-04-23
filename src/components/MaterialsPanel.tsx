import { useMemo, useState } from 'react';
import { useStore, type Material } from '../state/store';
import { processImageFile } from '../three/billboards';
import type { TextureKind } from '../three/textures';
import styles from './MaterialsPanel.module.css';

type Tab = 'materials' | 'cutouts';

export default function MaterialsPanel() {
  const [tab, setTab] = useState<Tab>('materials');
  return (
    <aside className={styles.panel}>
      <nav className={styles.tabs}>
        <button
          className={styles.tab}
          data-active={tab === 'materials'}
          onClick={() => setTab('materials')}
        >
          Materials
        </button>
        <button
          className={styles.tab}
          data-active={tab === 'cutouts'}
          onClick={() => setTab('cutouts')}
        >
          Cutouts
        </button>
      </nav>
      <div className={styles.body}>
        {tab === 'materials' ? <MaterialsTab /> : <CutoutsTab />}
      </div>
    </aside>
  );
}

function MaterialsTab() {
  const materials = useStore((s) => s.materials);
  const paletteOrder = useStore((s) => s.paletteOrder);
  const activeId = useStore((s) => s.activeMaterialId);
  const setActive = useStore((s) => s.setActiveMaterial);
  const addMaterial = useStore((s) => s.addMaterial);
  const primitives = useStore((s) => s.primitives);

  const [editingId, setEditingId] = useState<string | null>(null);

  const entries = useMemo(
    () => paletteOrder.map((id) => materials[id]).filter((m): m is Material => m != null),
    [paletteOrder, materials],
  );

  const usedIds = useMemo(() => {
    const used = new Set<string>();
    for (const p of primitives) if (p.materialId) used.add(p.materialId);
    return used;
  }, [primitives]);

  const onAdd = () => {
    const id = `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    addMaterial({
      id,
      name: `Material ${entries.length + 1}`,
      textureKind: 'plain',
      color: '#b5a88f',
      roughness: 0.6,
      metalness: 0.05,
    });
    setActive(id);
    setEditingId(id);
  };

  return (
    <div className={styles.list}>
      {entries.map((m) => (
        <MaterialRow
          key={m.id}
          material={m}
          active={m.id === activeId}
          inScene={usedIds.has(m.id)}
          editing={m.id === editingId}
          onSelect={() => setActive(m.id)}
          onOpenEditor={() => setEditingId(m.id)}
          onCloseEditor={() => setEditingId(null)}
        />
      ))}
      <button className={styles.addRow} onClick={onAdd}>
        <span className={styles.addRowPlus}>+</span>
        <span>New material</span>
      </button>
    </div>
  );
}

function MaterialRow({
  material,
  active,
  inScene,
  editing,
  onSelect,
  onOpenEditor,
  onCloseEditor,
}: {
  material: Material;
  active: boolean;
  inScene: boolean;
  editing: boolean;
  onSelect: () => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
}) {
  const updateMaterial = useStore((s) => s.updateMaterial);
  const removeMaterial = useStore((s) => s.removeMaterial);

  const onNameChange = (name: string) => updateMaterial(material.id, { name });
  const onColorChange = (color: string) => updateMaterial(material.id, { color });
  const onSecondaryChange = (secondaryColor: string) =>
    updateMaterial(material.id, { secondaryColor });
  const onTextureChange = (textureKind: TextureKind) =>
    updateMaterial(material.id, { textureKind });
  const onRoughnessChange = (roughness: number) =>
    updateMaterial(material.id, { roughness });
  const onMetalnessChange = (metalness: number) =>
    updateMaterial(material.id, { metalness });

  return (
    <div className={styles.row} data-active={active} data-editing={editing}>
      <button
        className={styles.rowHeader}
        onClick={onSelect}
        onDoubleClick={onOpenEditor}
        title={`${material.name} — click to select, double-click to edit`}
      >
        <span
          className={styles.preview}
          style={{ background: previewStyle(material) }}
        />
        <span className={styles.rowName}>{material.name}</span>
        {inScene && <span className={styles.usedDot} title="In use in the scene" />}
      </button>
      {editing && (
        <div className={styles.editor}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <input
              className={styles.input}
              type="text"
              value={material.name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Colour</span>
            <div className={styles.colorRow}>
              <input
                className={styles.colorSwatch}
                type="color"
                value={material.color}
                onChange={(e) => onColorChange(e.target.value)}
              />
              <input
                className={styles.input}
                type="text"
                value={material.color}
                onChange={(e) => onColorChange(e.target.value)}
              />
            </div>
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Texture</span>
            <div className={styles.segmented}>
              {(['plain', 'checker', 'noise', 'brick'] as TextureKind[]).map((kind) => (
                <button
                  key={kind}
                  className={styles.segment}
                  data-active={material.textureKind === kind}
                  onClick={() => onTextureChange(kind)}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          {(material.textureKind === 'checker' || material.textureKind === 'brick') && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Second</span>
              <div className={styles.colorRow}>
                <input
                  className={styles.colorSwatch}
                  type="color"
                  value={material.secondaryColor ?? '#444444'}
                  onChange={(e) => onSecondaryChange(e.target.value)}
                />
                <input
                  className={styles.input}
                  type="text"
                  value={material.secondaryColor ?? '#444444'}
                  onChange={(e) => onSecondaryChange(e.target.value)}
                />
              </div>
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Rough</span>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={material.roughness}
              onChange={(e) => onRoughnessChange(parseFloat(e.target.value))}
            />
            <span className={styles.sliderValue}>{material.roughness.toFixed(2)}</span>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Metal</span>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={material.metalness}
              onChange={(e) => onMetalnessChange(parseFloat(e.target.value))}
            />
            <span className={styles.sliderValue}>{material.metalness.toFixed(2)}</span>
          </label>

          <div className={styles.editorActions}>
            <button className={styles.dangerButton} onClick={() => removeMaterial(material.id)}>
              Delete
            </button>
            <button className={styles.primaryButton} onClick={onCloseEditor}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CutoutsTab() {
  const images = useStore((s) => s.cutoutImages);
  const activeId = useStore((s) => s.activeCutoutImageId);
  const setActive = useStore((s) => s.setActiveCutoutImage);
  const addImage = useStore((s) => s.addCutoutImage);
  const removeImage = useStore((s) => s.removeCutoutImage);

  const entries = Object.values(images);

  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const file of files) {
        const processed = await processImageFile(file);
        const id = `cut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        addImage({
          id,
          name: file.name,
          textureDataUrl: processed.textureDataUrl,
          width: processed.width,
          height: processed.height,
        });
        setActive(id);
      }
    };
    input.click();
  };

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No cutouts yet.</p>
        <button className={styles.primaryButton} onClick={onImport}>
          Import images
        </button>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {entries.map((img) => (
        <div key={img.id} className={styles.row} data-active={activeId === img.id}>
          <button
            className={styles.rowHeader}
            onClick={() => setActive(img.id)}
            title={img.name}
          >
            <span
              className={styles.preview}
              style={{
                backgroundImage: `url(${img.textureDataUrl})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            />
            <span className={styles.rowName}>{img.name}</span>
            <button
              className={styles.removeIcon}
              onClick={(e) => {
                e.stopPropagation();
                removeImage(img.id);
              }}
              title="Remove"
            >
              ×
            </button>
          </button>
        </div>
      ))}
      <button className={styles.addRow} onClick={onImport}>
        <span className={styles.addRowPlus}>+</span>
        <span>Import image</span>
      </button>
    </div>
  );
}

function previewStyle(m: Material): string {
  if (m.textureKind === 'plain') return m.color;
  const b = m.secondaryColor ?? m.color;
  if (m.textureKind === 'checker') {
    return `conic-gradient(from 45deg, ${m.color} 0 25%, ${b} 25% 50%, ${m.color} 50% 75%, ${b} 75%)`;
  }
  if (m.textureKind === 'brick') {
    return `linear-gradient(to bottom, ${m.color} 0 48%, ${b} 48% 52%, ${m.color} 52%)`;
  }
  return `radial-gradient(circle at 30% 30%, ${m.color}, ${b})`;
}
