import { useState } from 'react';
import { Button, RefreshCw, X } from '@florabot/ui';

export function ChatImage({ src, alt }: { src: string; alt?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const imageSrc = retryKey > 0 ? `${src}?r=${retryKey}` : src;

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
          type="button"
          className="chat-image-button"
          onClick={() => setModalOpen(true)}
          aria-label="Xem ảnh phóng to"
        >
          <img
            key={retryKey}
            src={imageSrc}
            alt={alt || 'Hình ảnh đính kèm trong tin nhắn'}
            loading="lazy"
            className={`chat-image ${status === 'loaded' ? 'is-loaded' : 'is-hidden'}`}
            onLoad={() => setStatus('loaded')}
            onError={() => setStatus('error')}
          />
        </button>
      )}

      {modalOpen && (
        <div
          className="chat-image-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
        >
          <button
            type="button"
            className="chat-image-modal-backdrop"
            onClick={() => setModalOpen(false)}
            aria-label="Đóng ảnh phóng to"
          />
          <div className="chat-image-modal-content">
            <button
              type="button"
              className="chat-image-modal-close"
              onClick={() => setModalOpen(false)}
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
