import { useStore } from '../state/store';
import { undo, redo, useHistoryState } from '../hooks/useHistory';
import { exportPNG } from '../utils/export';
import styles from './Toolbar.module.css';

export default function Toolbar() {
  const previewVisible = useStore((s) => s.previewVisible);
  const togglePreview = useStore((s) => s.togglePreview);
  const { canUndo, canRedo } = useHistoryState();

  return (
    <header className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.project}>Untitled Project</span>
        <div className={styles.sep} />
        <div className={styles.tabs}>
          <button className={styles.tab} data-active="true">Scene 1</button>
          <button className={styles.tab}>+</button>
        </div>
      </div>

      <div className={styles.right}>
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ⎌
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ⎌
        </button>
        <div className={styles.sep} />
        <button>Save</button>
        <button onClick={() => exportPNG()} title="Download scene as PNG">
          Export
        </button>
        <div className={styles.sep} />
        <button
          data-active={previewVisible}
          onClick={togglePreview}
          title="Toggle render preview"
        >
          ⧉ Preview
        </button>
      </div>
    </header>
  );
}
