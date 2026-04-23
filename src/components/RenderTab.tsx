import { useStore } from '../state/store';
import { exportPNG } from '../utils/export';
import styles from './RightPanel.module.css';

export default function RenderTab() {
  const state = useStore((s) => s.renderState);
  const update = useStore((s) => s.updateRender);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Background</div>
      <div className={styles.row}>
        <button
          data-active={state.backgroundTransparent}
          onClick={() => update({ backgroundTransparent: true })}
        >
          Transparent
        </button>
        <button
          data-active={!state.backgroundTransparent}
          onClick={() => update({ backgroundTransparent: false })}
        >
          Color
        </button>
      </div>
      {!state.backgroundTransparent && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Color</label>
          <input
            className={styles.input}
            type="color"
            value={state.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
          />
        </div>
      )}

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Shadows
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Intensity</label>
        <input
          className={styles.input}
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={state.shadowIntensity}
          onChange={(e) => update({ shadowIntensity: parseFloat(e.target.value) })}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-2)', width: 36, textAlign: 'right' }}>
          {state.shadowIntensity.toFixed(2)}
        </span>
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Export resolution
      </div>
      <div className={styles.row}>
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            data-active={state.exportScale === s}
            onClick={() => update({ exportScale: s })}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className={styles.row} style={{ marginTop: 4 }}>
        <button style={{ flex: 1 }} onClick={() => exportPNG()}>
          Download PNG
        </button>
      </div>
      <div className={styles.row}>
        <button style={{ flex: 1 }} onClick={() => exportPNG({ shadowOnly: true })}>
          Download shadow pass
        </button>
      </div>
    </div>
  );
}
