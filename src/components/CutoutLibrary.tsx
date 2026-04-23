import { useStore } from '../state/store';
import { processImageFile } from '../three/billboards';
import styles from './PaletteList.module.css';

export default function CutoutLibrary() {
  const images = useStore((s) => s.cutoutImages);
  const activeId = useStore((s) => s.activeCutoutImageId);
  const addImage = useStore((s) => s.addCutoutImage);
  const removeImage = useStore((s) => s.removeCutoutImage);
  const setActive = useStore((s) => s.setActiveCutoutImage);

  const entries = Object.values(images);

  const onImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (const file of files) {
        try {
          const processed = await processImageFile(file);
          const id = `cut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
          addImage({
            id,
            name: file.name,
            textureDataUrl: processed.textureDataUrl,
            width: processed.width,
            height: processed.height,
          });
          setActive(id);
        } catch (err) {
          alert(`Failed to load ${file.name}: ${(err as Error).message}`);
        }
      }
    };
    input.click();
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>Cutouts</div>
      <div className={styles.grid}>
        {entries.map((img) => (
          <button
            key={img.id}
            className={styles.swatch}
            data-active={activeId === img.id}
            title={`${img.name} — click to select, right-click to remove`}
            style={{
              backgroundImage: `url(${img.textureDataUrl})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: 'rgba(255,255,255,0.05)',
            }}
            onClick={() => setActive(img.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`Remove "${img.name}"?`)) removeImage(img.id);
            }}
          />
        ))}
        <button className={styles.addButton} onClick={onImport} title="Import image(s)">
          +
        </button>
      </div>
    </section>
  );
}
