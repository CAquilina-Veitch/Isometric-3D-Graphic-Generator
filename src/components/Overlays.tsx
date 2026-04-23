import { useStore } from '../state/store';
import styles from './Overlays.module.css';

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'V', description: 'Select tool' },
  { keys: '1 / 2 / 3 / 4', description: 'Cube / Tile / Stairs / Slope' },
  { keys: 'B', description: 'Brush tool' },
  { keys: 'E', description: 'Erase tool' },
  { keys: 'C', description: 'Cutout tool' },
  { keys: 'R', description: 'Rotate selection 90° / rotate placement ghost' },
  { keys: 'Del / Backspace', description: 'Delete selection' },
  { keys: 'Esc', description: 'Deselect / exit placement' },
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Redo' },
  { keys: '?', description: 'Toggle this help' },
  { keys: 'Scroll', description: 'Zoom editor camera' },
  { keys: 'Middle-drag', description: 'Pan editor camera' },
  { keys: 'Right-drag', description: 'Orbit editor camera' },
  { keys: 'Alt + Left-drag', description: 'Orbit (trackpad fallback)' },
];

export default function Overlays() {
  const helpOpen = useStore((s) => s.helpOpen);
  const toggleHelp = useStore((s) => s.toggleHelp);
  const primitiveCount = useStore((s) => s.primitives.length);
  const cutoutCount = useStore((s) => s.cutouts.length);
  const activeTool = useStore((s) => s.activeTool);

  return (
    <div className={styles.overlays}>
      {primitiveCount === 0 && cutoutCount === 0 && (
        <div className={styles.emptyHint}>
          {activeTool === 'select'
            ? 'Empty scene — pick a primitive tool and click the grid to start building.'
            : 'Click the grid to place. Press ? for shortcuts.'}
        </div>
      )}

      {helpOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) toggleHelp();
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span>Keyboard shortcuts</span>
              <button onClick={toggleHelp}>✕</button>
            </div>
            <ul className={styles.shortcutList}>
              {SHORTCUTS.map((s) => (
                <li key={s.keys}>
                  <kbd>{s.keys}</kbd>
                  <span>{s.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
