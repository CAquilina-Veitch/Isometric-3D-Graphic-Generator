import { useEffect, useState } from 'react';
import { useStore, type Primitive } from '../state/store';
import { record } from '../hooks/useHistory';
import styles from './RightPanel.module.css';

export default function PropertiesTab() {
  const selectedIds = useStore((s) => s.selectedIds);
  const primitive = useStore((s) =>
    selectedIds.length === 1
      ? s.primitives.find((p) => p.id === selectedIds[0]) ?? null
      : null,
  );

  if (!primitive) {
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

  return <BoundProperties key={primitive.id} primitive={primitive} />;
}

function BoundProperties({ primitive }: { primitive: Primitive }) {
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
        <div
          className={styles.swatch}
          style={{ background: 'hsl(210 40% 55%)' }}
        />
        <span className={styles.materialLabel}>(default)</span>
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
