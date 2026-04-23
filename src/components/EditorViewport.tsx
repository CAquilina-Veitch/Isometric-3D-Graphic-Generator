import styles from './Viewport.module.css';

export default function EditorViewport() {
  return (
    <div className={styles.viewport} data-kind="editor">
      <div className={styles.placeholderLabel}>Editor (M3)</div>
      <div className={styles.placeholderSub}>Three.js canvas mounts here</div>
    </div>
  );
}
