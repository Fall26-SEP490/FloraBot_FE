import { useEffect, useId, useRef } from 'react';
import { X } from '@florabot/ui';
import styles from './evidence-preview.module.css';

export default function EvidencePreview({ file }: { file: File }) {
  const thumbnail = useRef<HTMLImageElement>(null);
  const fullImage = useRef<HTMLImageElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (thumbnail.current) thumbnail.current.src = url;
    if (fullImage.current) fullImage.current.src = url;
    // Keep Escape/Tab inside the native dialog rather than reaching the parent modal.
    const imageDialog = dialog.current;
    const containKey = (event: Event) => event.stopPropagation();
    imageDialog?.addEventListener('keydown', containKey);
    imageDialog?.addEventListener('cancel', containKey);
    return () => {
      URL.revokeObjectURL(url);
      imageDialog?.removeEventListener('keydown', containKey);
      imageDialog?.removeEventListener('cancel', containKey);
    };
  }, [file]);
  return (
    <>
      <button
        type="button"
        className={styles.preview}
        onClick={() => dialog.current?.showModal()}
        aria-label="Phóng to ảnh minh chứng"
      >
        <img ref={thumbnail} alt="Ảnh minh chứng đã chọn" />
        <span className={styles.meta}>
          <span className={styles.name} title={file.name}>
            {file.name}
          </span>
          <span className={styles.hint}>Xem ảnh</span>
        </span>
      </button>
      <dialog tabIndex={-1} ref={dialog} className={styles.dialog} aria-labelledby={title}>
        <header>
          <strong id={title}>Ảnh minh chứng</strong>
          <button
            type="button"
            className={styles.close}
            aria-label="Đóng ảnh"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <img ref={fullImage} alt="Ảnh minh chứng phóng to" />
      </dialog>
    </>
  );
}
