import { useStore } from '../state/store';
import EditorViewport from './EditorViewport';
import PreviewViewport from './PreviewViewport';
import styles from './ViewportSplit.module.css';

export default function ViewportSplit() {
  const previewVisible = useStore((s) => s.previewVisible);

  return (
    <section className={styles.split} data-preview={previewVisible}>
      <div className={styles.editorPane}>
        <EditorViewport />
      </div>
      {previewVisible && (
        <>
          <div className={styles.divider} />
          <div className={styles.previewPane}>
            <PreviewViewport />
          </div>
        </>
      )}
    </section>
  );
}
