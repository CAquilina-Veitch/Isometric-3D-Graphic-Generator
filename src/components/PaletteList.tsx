import { useStore, type Material } from '../state/store';
import styles from './PaletteList.module.css';

const TEXTURE_KINDS: Material['textureKind'][] = ['plain', 'checker', 'noise', 'brick'];

export default function PaletteList() {
  const materials = useStore((s) => s.materials);
  const paletteOrder = useStore((s) => s.paletteOrder);
  const activeId = useStore((s) => s.activeBrushMaterialId);
  const setActiveId = useStore((s) => s.setActiveBrushMaterial);
  const addMaterial = useStore((s) => s.addMaterial);
  const removeMaterial = useStore((s) => s.removeMaterial);
  const replacePalette = useStore((s) => s.replacePalette);

  const entries = paletteOrder
    .map((id) => materials[id])
    .filter((m): m is Material => m != null);

  const onAdd = () => {
    const hue = Math.floor(Math.random() * 360);
    const color = hslToHex(hue, 55, 55);
    const kind = TEXTURE_KINDS[Math.floor(Math.random() * TEXTURE_KINDS.length)];
    const id = `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    addMaterial({
      id,
      name: `Material ${entries.length + 1}`,
      textureKind: kind,
      color,
      secondaryColor: hslToHex(hue, 45, 35),
      roughness: 0.6,
      metalness: 0.05,
    });
    setActiveId(id);
  };

  const onExport = () => {
    const blob = new Blob(
      [JSON.stringify({ version: 1, materials: entries }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palette.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.materials)) {
          throw new Error('Invalid palette file — expected { materials: [...] }');
        }
        replacePalette(parsed.materials);
      } catch (err) {
        alert(`Failed to import palette: ${(err as Error).message}`);
      }
    };
    input.click();
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>Palette</div>
      <div className={styles.grid}>
        {entries.map((m) => (
          <button
            key={m.id}
            className={styles.swatch}
            data-active={activeId === m.id}
            title={`${m.name} — click to select, right-click to remove`}
            style={{ background: swatchBackground(m) }}
            onClick={() => setActiveId(m.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`Remove "${m.name}" from palette?`)) removeMaterial(m.id);
            }}
          />
        ))}
        <button className={styles.addButton} onClick={onAdd} title="Add random material">
          +
        </button>
      </div>
      <div className={styles.row}>
        <button onClick={onImport}>Import</button>
        <button onClick={onExport}>Export</button>
      </div>
    </section>
  );
}

function swatchBackground(m: Material): string {
  if (m.textureKind === 'plain') return m.color;
  const b = m.secondaryColor ?? m.color;
  if (m.textureKind === 'checker') {
    return `conic-gradient(from 45deg, ${m.color} 0 25%, ${b} 25% 50%, ${m.color} 50% 75%, ${b} 75%)`;
  }
  if (m.textureKind === 'brick') {
    return `linear-gradient(${m.color}, ${m.color}) padding-box, linear-gradient(${b}, ${b})`;
  }
  return `linear-gradient(135deg, ${m.color} 0%, ${b} 100%)`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
