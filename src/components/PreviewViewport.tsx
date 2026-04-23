import styles from './Viewport.module.css';

export default function PreviewViewport() {
  return (
    <div className={styles.viewport} data-kind="preview">
      <div className={styles.placeholderLabel}>Preview (M3)</div>
      <div className={styles.placeholderSub}>Locked render camera</div>
    </div>
  );
}
