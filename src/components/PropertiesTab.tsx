import { useEffect, useMemo, useState } from 'react';
import { useStore, type Cutout, type Primitive } from '../state/store';
import { record } from '../hooks/useHistory';
import styles from './RightPanel.module.css';

type Selection =
  | { kind: 'primitive'; value: Primitive }
  | { kind: 'cutout'; value: Cutout }
  | null;

export default function PropertiesTab() {
  const selectedIds = useStore((s) => s.selectedIds);
  const primitives = useStore((s) => s.primitives);
  const cutouts = useStore((s) => s.cutouts);

  // IMPORTANT: compute the tagged selection OUTSIDE the store selector.
  // Returning `{ kind, value }` from inside a Zustand selector creates a fresh
  // object on every store read, which makes React 19's useSyncExternalStore
  // treat every snapshot as different → "Maximum update depth exceeded".
  const selection = useMemo<Selection>(() => {
    if (selectedIds.length !== 1) return null;
    const id = selectedIds[0];
    const primitive = primitives.find((p) => p.id === id);
    if (primitive) return { kind: 'primitive', value: primitive };
    const cutout = cutouts.find((c) => c.id === id);
    if (cutout) return { kind: 'cutout', value: cutout };
    return null;
  }, [selectedIds, primitives, cutouts]);

  if (!selection) {
    return (
      <div className={styles.section}>
        <p className={styles.muted}>
          {selectedIds.length === 0
            ? 'Nothing selected. Click an object with the Select tool.'
            : `${selectedIds.length} objects selected.`}
        </p>
      </div>
    );
  }

  return selection.kind === 'primitive' ? (
    <BoundPrimitive key={selection.value.id} primitive={selection.value} />
  ) : (
    <BoundCutout key={selection.value.id} cutout={selection.value} />
  );
}

function BoundPrimitive({ primitive }: { primitive: Primitive }) {
  const updatePrimitive = useStore((s) => s.updatePrimitive);

  const commitAxis = (
    field: 'position' | 'rotation' | 'scale',
    axis: 'x' | 'y' | 'z',
    value: number,
  ) => {
    record(() => {
      updatePrimitive(primitive.id, {
        [field]: { ...primitive[field], [axis]: value },
      });
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        {primitive.type.charAt(0).toUpperCase() + primitive.type.slice(1)}
      </div>
      <div className={styles.muted} style={{ fontSize: 10, fontFamily: 'monospace' }}>
        id: {primitive.id}
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Transform
      </div>
      <Vec3Field
        label="Position"
        value={primitive.position}
        onCommit={(axis, v) => commitAxis('position', axis, v)}
        step={0.25}
      />
      <Vec3Field
        label="Rotation"
        value={primitive.rotation}
        onCommit={(axis, v) => commitAxis('rotation', axis, v)}
        step={15}
      />
      <Vec3Field
        label="Scale"
        value={primitive.scale}
        onCommit={(axis, v) => commitAxis('scale', axis, v)}
        step={0.1}
      />

      <div className={styles.sectionTitle} style={{ marginTop: 14 }}>
        Material
      </div>
      <div className={styles.materialRow}>
        <div className={styles.swatch} style={{ background: 'hsl(210 40% 55%)' }} />
        <span className={styles.materialLabel}>(default)</span>
      </div>
    </div>
  );
}

function BoundCutout({ cutout }: { cutout: Cutout }) {
  const updateCutout = useStore((s) => s.updateCutout);
  const image = useStore((s) => s.cutoutImages[cutout.imageId]);

  const commitAxis = (
    field: 'position' | 'rotation' | 'scale',
    axis: 'x' | 'y' | 'z',
    value: number,
  ) => {
    record(() => {
      updateCutout(cutout.id, {
        [field]: { ...cutout[field], [axis]: value },
      });
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Cutout</div>
      <div className={styles.muted} style={{ fontSize: 10, fontFamily: 'monospace' }}>
        {image?.name ?? '(missing image)'}
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Transform
      </div>
      <Vec3Field
        label="Position"
        value={cutout.position}
        onCommit={(axis, v) => commitAxis('position', axis, v)}
        step={0.25}
      />
      <Vec3Field
        label="Rotation"
        value={cutout.rotation}
        onCommit={(axis, v) => commitAxis('rotation', axis, v)}
        step={15}
      />
      <Vec3Field
        label="Scale"
        value={cutout.scale}
        onCommit={(axis, v) => commitAxis('scale', axis, v)}
        step={0.1}
      />

      <div className={styles.sectionTitle} style={{ marginTop: 14 }}>
        Facing
      </div>
      <div className={styles.row}>
        <button
          data-active={cutout.facing === 'fixed'}
          onClick={() => record(() => updateCutout(cutout.id, { facing: 'fixed' }))}
        >
          Fixed
        </button>
        <button
          data-active={cutout.facing === 'billboard'}
          onClick={() => record(() => updateCutout(cutout.id, { facing: 'billboard' }))}
        >
          Billboard
        </button>
      </div>
    </div>
  );
}

type Axis = 'x' | 'y' | 'z';

function Vec3Field({
  label,
  value,
  onCommit,
  step = 0.1,
}: {
  label: string;
  value: { x: number; y: number; z: number };
  onCommit: (axis: Axis, v: number) => void;
  step?: number;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.fieldInputs}>
        <NumberInput value={value.x} step={step} onCommit={(v) => onCommit('x', v)} />
        <NumberInput value={value.y} step={step} onCommit={(v) => onCommit('y', v)} />
        <NumberInput value={value.z} step={step} onCommit={(v) => onCommit('z', v)} />
      </div>
    </div>
  );
}

function NumberInput({
  value,
  step,
  onCommit,
}: {
  value: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value.toString());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && parsed !== value) onCommit(parsed);
    else setDraft(value.toString());
  };

  return (
    <input
      className={styles.input}
      type="number"
      value={draft}
      step={step}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        else if (e.key === 'Escape') {
          setDraft(value.toString());
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
