import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, RefreshCw, X } from '@florabot/ui';

export function ChatImage({ src, alt }: { src: string; alt?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const refreshedOnceRef = useRef(false);

  const imageSrc = retryKey > 0 ? `${src}${src.includes('?') ? '&' : '?'}r=${retryKey}` : src;

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setStatus('loaded');
    }
  }, [imageSrc]);

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleImageError = async () => {
    if (!refreshedOnceRef.current) {
      refreshedOnceRef.current = true;
      try {
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshed.ok) {
          setStatus('loading');
          setRetryKey((k) => k + 1);
          return;
        }
      } catch {
        /* Fall through to error UI */
      }
    }
    setStatus('error');
  };

  useEffect(() => {
    if (!modalOpen) return;

    // Focus close button on mount
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseModal();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, handleCloseModal]);

  return (
    <div className="chat-image-wrapper">
      {status === 'loading' && (
        <div className="chat-image-loading" role="status" aria-label="Đang tải ảnh...">
          <span className="chat-image-spinner" aria-hidden="true" />
          <span>Đang tải ảnh…</span>
        </div>
      )}

      {status === 'error' ? (
        <div className="chat-image-error" role="alert">
          <p>Không thể hiển thị ảnh</p>
          <Button
            type="button"
            variant="outline"
            className="chat-image-retry-btn"
            onClick={() => {
              refreshedOnceRef.current = false;
              setStatus('loading');
              setRetryKey((k) => k + 1);
            }}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className="chat-image-button"
          onClick={handleOpenModal}
          disabled={status !== 'loaded'}
          aria-busy={status === 'loading'}
          aria-label="Xem ảnh phóng to"
        >
          <img
            ref={imgRef}
            key={retryKey}
            src={imageSrc}
            alt={alt || 'Hình ảnh đính kèm trong tin nhắn'}
            className={`chat-image ${status === 'loaded' ? 'is-loaded' : 'is-hidden'}`}
            onLoad={() => setStatus('loaded')}
            onError={() => void handleImageError()}
          />
        </button>
      )}

      {modalOpen && (
        <div
          ref={modalRef}
          className="chat-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
        >
          <button
            type="button"
            className="chat-image-modal-backdrop"
            onClick={handleCloseModal}
            aria-label="Đóng ảnh phóng to"
          />
          <div className="chat-image-modal-content">
            <button
              ref={closeBtnRef}
              type="button"
              className="chat-image-modal-close"
              onClick={handleCloseModal}
              aria-label="Đóng ảnh phóng to"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <img
              src={imageSrc}
              alt={alt || 'Hình ảnh đính kèm phóng to'}
              className="chat-image-modal-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}
