import { useStore } from '../state/store';
import styles from './RightPanel.module.css';

export default function CameraTab() {
  const state = useStore((s) => s.renderCameraState);
  const update = useStore((s) => s.updateRenderCamera);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Render camera</div>
      <p className={styles.muted}>
        Locked to the final export angle. Preview and PNG exports use this camera.
      </p>

      <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
        Iso angle
      </div>
      <div className={styles.row}>
        {([30, 45, 60] as const).map((angle) => (
          <button
            key={angle}
            data-active={state.isoAnglePreset === angle}
            onClick={() => update({ isoAnglePreset: angle })}
          >
            {angle}°
          </button>
        ))}
      </div>

      <div className={styles.field} style={{ marginTop: 10 }}>
        <label className={styles.fieldLabel}>Zoom</label>
        <input
          className={styles.input}
          type="range"
          min={2}
          max={20}
          step={0.25}
          value={state.zoom}
          onChange={(e) => update({ zoom: parseFloat(e.target.value) })}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-2)', width: 36, textAlign: 'right' }}>
          {state.zoom.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
